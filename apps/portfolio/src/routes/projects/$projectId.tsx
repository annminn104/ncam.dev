import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { ModuleFederation } from '@module-federation/runtime';
import { getProject, type ProjectEntry } from '@ncam/project-registry';
import { createLogger } from '@ncam/logger';

const log = createLogger({ scope: 'portfolio' });

const SITE_URL = 'https://ncam.dev';
/** Federation host name — must match `federation({ name })` in vite.config.ts. */
const HOST_NAME = 'portfolio';

// Static import specifiers so the Module Federation plugin can transform them.
// `./ssr` is server-safe (loader); `./hydrate` / `./mount` are client-only.
type SsrResult = { html: string; css: string };
type RenderHeroSSR = (opts?: {
  config?: unknown;
  assetBase?: string;
}) => SsrResult | Promise<SsrResult>;
type SsrExports = { renderHeroSSR?: RenderHeroSSR };
type HydrateModule = { hydrate: (target: HTMLElement) => () => void };
type MountModule = { mount: (el: HTMLElement, config?: unknown) => () => void };

// In the production server bundle the federation plugin rewrites each of these
// into: import the generated wrapper (which boots the host runtime and starts
// loading the remote), then await the wrapper's `__mf_remote_pending`. That
// promise is created once per process, so after a single failed attempt the
// import rejects forever, and even when it resolves the module namespace only
// carries the wrapper's own exports — never `renderHeroSSR`. Treat the result
// as opaque; `loadSsrExports()` reads the module from the runtime instead.
const ssrLoaders: Record<string, () => Promise<unknown>> = {
  toonhub: () => import('toonhub/ssr'),
  mindloop: () => import('mindloop/ssr'),
  immersive_ocean: () => import('immersive_ocean/ssr'),
  viktor: () => import('viktor/ssr'),
};
const hydrateLoaders: Record<string, () => Promise<HydrateModule>> = {
  toonhub: () => import('toonhub/hydrate'),
  mindloop: () => import('mindloop/hydrate'),
  immersive_ocean: () => import('immersive_ocean/hydrate'),
  viktor: () => import('viktor/hydrate'),
};
const mountLoaders: Record<string, () => Promise<MountModule>> = {
  toonhub: () => import('toonhub/mount'),
  mindloop: () => import('mindloop/mount'),
  immersive_ocean: () => import('immersive_ocean/mount'),
  viktor: () => import('viktor/mount'),
};

interface LoaderData {
  html: string | null;
  css: string;
}
const NO_SSR: LoaderData = { html: null, css: '' };

async function getHostRuntime(): Promise<ModuleFederation> {
  const { getInstance } = await import('@module-federation/runtime');
  const runtime = getInstance((instance) => instance.name === HOST_NAME) ?? getInstance();
  if (!runtime) throw new Error('federation host runtime is not initialised');
  return runtime;
}

/**
 * Make a remote loadable again after a failed attempt (typically: the remote
 * was not up yet when the host booted). Two caches remember the failure and
 * never expire on their own — runtime-core keeps the rejected entry-load
 * promise, and the vite plugin's SSR loader caches its (null) SSR-entry
 * resolution — so without this the remote stays un-renderable until restart.
 */
async function forgetFailedRemote(runtime: ModuleFederation, name: string): Promise<void> {
  const remote = runtime.options.remotes.find((candidate) => candidate.name === name);
  if (!remote) {
    log.warn('project.ssr-forget-skipped', {
      remote: name,
      known: runtime.options.remotes.map((candidate) => candidate.name),
    });
    return;
  }
  // Re-registering with `force` drops the remote's module and its cached entry load.
  runtime.registerRemotes([{ ...remote }], { force: true });
  if ('entry' in remote && remote.entry) {
    const { revalidate } = await import('@module-federation/vite/ssrEntryLoader');
    revalidate(remote.entry);
  }
  log.info('project.ssr-remote-reset', { remote: name });
}

/**
 * Resolve a remote's `./ssr` module on the server. The transformed import
 * (see `ssrLoaders`) is only awaited for its side effect — booting the host
 * runtime and attempting the load; its stale rejection must not decide the
 * outcome, so the module is always taken from the runtime itself.
 */
async function loadSsrExports(
  project: ProjectEntry,
  load: () => Promise<unknown>,
): Promise<{ renderHeroSSR: RenderHeroSSR }> {
  await load().catch(() => undefined);
  const runtime = await getHostRuntime();
  try {
    const exports = await runtime.loadRemote<SsrExports>(`${project.remote}/ssr`);
    const renderHeroSSR = exports?.renderHeroSSR;
    if (typeof renderHeroSSR !== 'function') {
      throw new Error(`${project.remote}/ssr does not export renderHeroSSR`);
    }
    return { renderHeroSSR };
  } catch (error) {
    await forgetFailedRemote(runtime, project.remote).catch((cleanupError: unknown) => {
      log.warn('project.ssr-forget-failed', { id: project.id, error: String(cleanupError) });
    });
    throw error;
  }
}

export const Route = createFileRoute('/projects/$projectId')({
  // SSR the remote's markup for SEO / first paint. Federated SSR resolution is
  // only wired in the production build — in `vite dev` this throws, so we fall
  // back to client-side mount (below). Either way the loader stays graceful.
  loader: async ({ params }): Promise<LoaderData> => {
    const project = getProject(params.projectId);
    if (!project || project.status !== 'live') return NO_SSR;
    const load = ssrLoaders[project.remote];
    // Federated SSR is only wired up in the production *server* build: `vite dev`
    // can't resolve it (and may hang), and client-side navigations take the
    // lighter mount path instead of rendering markup in the browser. The SSR
    // guard also keeps the Node-only recovery code out of the client bundle.
    if (!load || !import.meta.env.PROD || !import.meta.env.SSR) return NO_SSR;
    try {
      const { renderHeroSSR } = await loadSsrExports(project, load);
      const { html, css } = await renderHeroSSR({ assetBase: import.meta.env.VITE_TOONHUB_ORIGIN });
      log.debug('project.ssr', { id: project.id });
      return { html, css };
    } catch (error) {
      // SSR remote resolution unavailable → client-side mount. Loud on purpose:
      // a silent fallback hid a broken SSR path in production for months.
      log.warn('project.ssr-fallback', {
        id: project.id,
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
      return NO_SSR;
    }
  },
  // Per-project SEO. The route is SSR'd, so crawlers get a project-specific
  // title/description/canonical + Open Graph, even for client-mounted remotes.
  head: ({ params }) => {
    const project = getProject(params.projectId);
    if (!project) {
      return {
        meta: [{ title: 'Project not found — ncam.dev' }, { name: 'robots', content: 'noindex' }],
      };
    }
    const title = `${project.name} — ${project.tagline} · ncam.dev`;
    const description = project.description;
    const url = `${SITE_URL}/projects/${project.id}`;
    const image = project.thumbnail ? `${SITE_URL}${project.thumbnail}` : undefined;
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { name: 'robots', content: project.status === 'live' ? 'index,follow' : 'noindex' },
        { property: 'og:type', content: 'article' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: url },
        ...(image
          ? [
              { property: 'og:image', content: image },
              { property: 'og:image:width', content: '1200' },
              { property: 'og:image:height', content: '630' },
            ]
          : []),
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        ...(image ? [{ name: 'twitter:image', content: image }] : []),
      ],
      links: [{ rel: 'canonical', href: url }],
    };
  },
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { html, css } = Route.useLoaderData();
  const project = getProject(projectId);
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project || project.status !== 'live') return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    // SSR available → hydrate the server-rendered DOM. Otherwise → client mount.
    const attach = html
      ? hydrateLoaders[project.remote]?.().then((m) => m.hydrate)
      : mountLoaders[project.remote]?.().then((m) => m.mount);
    attach
      ?.then((fn) => {
        if (!cancelled && mountRef.current) {
          dispose = fn(mountRef.current);
          log.info('project.open', { id: project.id, mode: html ? 'ssr-hydrate' : 'csr-mount' });
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        log.error('project.mount-failed', { id: project.id, error: message });
        setError(message);
      });
    return () => {
      cancelled = true;
      try {
        dispose?.();
      } catch {
        /* ignore disposer errors */
      }
    };
  }, [project, html]);

  if (!project) {
    return (
      <div className="stage">
        <Link to="/" className="stage__back">
          <span aria-hidden="true">←</span> Projects
        </Link>
        <div className="stage__error">
          <h2>Project not found</h2>
          <p>No project with id "{projectId}".</p>
        </div>
      </div>
    );
  }

  const projectUrl = `${SITE_URL}/projects/${project.id}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Projects', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: project.name, item: projectUrl },
        ],
      },
      {
        '@type': 'CreativeWork',
        name: project.name,
        headline: project.tagline,
        description: project.description,
        url: projectUrl,
        author: { '@type': 'Person', name: 'Nguyen Cao Anh Minh' },
      },
    ],
  };

  return (
    <div className="stage">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link to="/" className="stage__back">
        <span aria-hidden="true">←</span> Projects
      </Link>
      {error ? (
        <div className="stage__error">
          <h2>Couldn't load {project.name}</h2>
          <p>{error}</p>
          <p className="stage__hint">
            Make sure the <code>{project.remote}</code> remote is running (run <code>pnpm dev</code>{' '}
            at the repo root), then reload.
          </p>
        </div>
      ) : null}
      {/* SSR path fills this via dangerouslySetInnerHTML; CSR path via mount(). */}
      {html && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div
        // Fresh container per project so React never reuses one mount node
        // across different remotes (avoids cross-framework teardown races).
        key={project.id}
        className="stage__mount"
        ref={mountRef}
        aria-label={project.name}
        {...(html ? { dangerouslySetInnerHTML: { __html: html } } : {})}
      />
    </div>
  );
}
