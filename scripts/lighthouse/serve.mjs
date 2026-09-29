#!/usr/bin/env node
/**
 * Serves the production build for Lighthouse: every remote through
 * `vite preview`, the host's Nitro server, and a stand-in CMS answering
 * /api/articles from fixtures/articles.json, so the blog pages have a post to
 * render without a Strapi. Run it after `pnpm build`; it prints READY once
 * every server answers and each audited page has been requested once (the
 * host's swr cache and its remotes' SSR entries are warm, as they are behind
 * the CDN in production), and stops everything on SIGINT/SIGTERM.
 *
 * Each origin sits behind a small proxy that compresses like the CDN in front
 * of production (brotli, else gzip): `vite preview` and Nitro's node server
 * send everything uncompressed, and on Lighthouse's throttled mobile network
 * that alone put first paint at 4-8 s where production paints in 1-2 s. The
 * real servers listen 100 ports up; the proxies take the ports the host build
 * bakes into its remote URLs.
 *
 * Ports are the ones .env and the host build default to (host 9000, remotes
 * 9001-9007), shifted by LH_PORT_OFFSET so a run can sit beside the dev
 * servers. A non-zero offset needs a build made with the exports that
 * `--build-env` prints:
 *
 *   pnpm build && node scripts/lighthouse/serve.mjs          # what CI runs
 *   eval "$(LH_PORT_OFFSET=200 node scripts/lighthouse/serve.mjs --build-env)"
 *   pnpm build && LH_PORT_OFFSET=200 node scripts/lighthouse/serve.mjs
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants as zlib, createBrotliCompress, createGzip } from 'node:zlib';
import config from './config.cjs';

const { AUDITED_PATHS, READY, ports, remotes } = config;

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const { host: hostPort, cms: cmsPort } = ports();
/** Where each real server listens, behind its proxy. */
const BEHIND = 100;

if (process.argv.includes('--build-env')) {
  // Shell exports for a host build that points at the shifted remotes.
  for (const remote of remotes()) {
    console.log(`export ${remote.key}_REMOTE_URL=http://localhost:${remote.port}/remoteEntry.js`);
  }
  process.exit(0);
}

const articles = JSON.parse(
  readFileSync(join(root, 'scripts/lighthouse/fixtures/articles.json'), 'utf8'),
);

/** Strapi's list envelope around whatever the query selects. */
function listResponse(data) {
  return {
    data,
    meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: data.length } },
  };
}

/** The stand-in CMS: every query the site makes goes to /api/articles. */
const cms = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${cmsPort}`);
  if (url.pathname !== '/api/articles') {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end('{"data":null,"error":{"status":404}}');
    return;
  }
  const slug = url.searchParams.get('filters[slug][$eq]');
  const page = Number(url.searchParams.get('pagination[page]') ?? '1');
  const selected = slug
    ? articles.filter((article) => article.slug === slug)
    : page > 1
      ? []
      : articles;
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(listResponse(selected)));
});

const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml|manifest\+json)|image\/svg\+xml)/;

/**
 * A reverse proxy to `target` that compresses what a CDN would: text, scripts,
 * JSON and SVG, when the client accepts it and the server has not already.
 */
function compressingProxy(target) {
  return createServer((request, response) => {
    const upstream = httpRequest(
      {
        host: '127.0.0.1',
        port: target,
        method: request.method,
        path: request.url,
        // Ask upstream for the identity encoding: this proxy does the compressing.
        headers: { ...request.headers, host: `localhost:${target}`, 'accept-encoding': 'identity' },
      },
      (reply) => {
        const headers = { ...reply.headers };
        const type = String(headers['content-type'] ?? '');
        const accepted = String(request.headers['accept-encoding'] ?? '');
        const encoding =
          request.method === 'HEAD' || headers['content-encoding'] || !COMPRESSIBLE.test(type)
            ? null
            : /\bbr\b/.test(accepted)
              ? 'br'
              : /\bgzip\b/.test(accepted)
                ? 'gzip'
                : null;
        if (!encoding) {
          response.writeHead(reply.statusCode ?? 502, headers);
          reply.pipe(response);
          return;
        }
        delete headers['content-length'];
        headers['content-encoding'] = encoding;
        headers.vary = headers.vary ? `${headers.vary}, Accept-Encoding` : 'Accept-Encoding';
        response.writeHead(reply.statusCode ?? 502, headers);
        const compressor =
          encoding === 'br'
            ? createBrotliCompress({ params: { [zlib.BROTLI_PARAM_QUALITY]: 5 } })
            : createGzip({ level: 6 });
        reply.pipe(compressor).pipe(response);
      },
    );
    upstream.on('error', (error) => {
      if (!response.headersSent) response.writeHead(502, { 'content-type': 'text/plain' });
      response.end(`proxy: ${error.message}`);
    });
    request.pipe(upstream);
  });
}

const children = [];
const servers = [cms];

/**
 * Starts a server, prefixing its output with a label so the CI log reads. It
 * runs in a process group of its own: `pnpm exec` does not pass SIGTERM on to
 * the `vite preview` it starts, so stopping means signalling the whole group.
 */
function start(label, command, args, env) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const relay = (stream) =>
    stream.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n'))
        if (line.trim()) console.log(`[${label}] ${line}`);
    });
  relay(child.stdout);
  relay(child.stderr);
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`[${label}] exited with ${code}; stopping.`);
      stop(1);
    }
  });
  children.push(child);
}

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
  for (const server of servers) server.close();
  setTimeout(() => process.exit(code), 500).unref();
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
process.on('exit', () => {
  // Last resort if the process dies some other way: never leave a group behind.
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
});

/** Polls a URL until it answers 2xx, or gives up after `timeoutMs`. */
async function waitFor(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`${url} did not answer within ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

cms.listen(cmsPort, '127.0.0.1');

for (const remote of remotes()) {
  const behind = remote.port + BEHIND;
  start(
    remote.name,
    'pnpm',
    ['--filter', remote.pkg, 'exec', 'vite', 'preview', '--host', '127.0.0.1'],
    {
      [`${remote.key}_PORT`]: String(behind),
    },
  );
  const proxy = compressingProxy(behind);
  proxy.listen(remote.port, '127.0.0.1');
  servers.push(proxy);
}
const cmsOrigin = `http://127.0.0.1:${cmsPort}`;
start('host', 'node', ['apps/portfolio/.output/server/index.mjs'], {
  PORT: String(hostPort + BEHIND),
  HOST: '127.0.0.1',
  NODE_OPTIONS: '--experimental-vm-modules',
  STRAPI_URL: cmsOrigin,
  STRAPI_PUBLIC_URL: cmsOrigin,
});
const hostProxy = compressingProxy(hostPort + BEHIND);
hostProxy.listen(hostPort, '127.0.0.1');
servers.push(hostProxy);

try {
  await Promise.all(
    remotes().map((remote) => waitFor(`http://localhost:${remote.port}/remoteEntry.js`)),
  );
  const origin = `http://localhost:${hostPort}`;
  await waitFor(`${origin}/robots.txt`);
  // GET only: a HEAD would leave an empty body in the swr cache for / and /blog.
  for (const path of AUDITED_PATHS) {
    const response = await fetch(origin + path);
    await response.text();
    console.log(`warmed ${path}: HTTP ${response.status}`);
  }
  console.log(READY);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop(1);
}
