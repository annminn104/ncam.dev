import { federation } from '@module-federation/vite';
import { env } from '@ncam/mf-remote';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

// Config resolved from the root .env / .env.local (overridable by real env).
const TOONHUB_REMOTE = env('TOONHUB_REMOTE_URL', 'http://localhost:9001/remoteEntry.js');
// The remote's browser origin — used to resolve its asset URLs during SSR.
const TOONHUB_ORIGIN = new URL(TOONHUB_REMOTE).origin;
const MINDLOOP_REMOTE = env('MINDLOOP_REMOTE_URL', 'http://localhost:9002/remoteEntry.js');
const IMMERSIVE_OCEAN_REMOTE = env(
  'IMMERSIVE_OCEAN_REMOTE_URL',
  'http://localhost:9003/remoteEntry.js',
);
const VIKTOR_REMOTE = env('VIKTOR_REMOTE_URL', 'http://localhost:9004/remoteEntry.js');
const BALI_REMOTE = env('BALI_REMOTE_URL', 'http://localhost:9005/remoteEntry.js');
// The home page's own sections live in the `profile` remote (one module each).
const PROFILE_REMOTE = env('PROFILE_REMOTE_URL', 'http://localhost:9006/remoteEntry.js');
const PORTFOLIO_PORT = Number(env('PORTFOLIO_PORT', '9000'));

// Nitro leaves a handle open after its build, so `vite build` never exits on its
// own. Exiting on a fixed delay after `writeBundle` raced the SSR + Nitro server
// build on slow machines (an emulated Docker VM shipped an image with an empty
// .output/server). Nitro writes its manifest last, so exit only once a manifest
// newer than this build exists alongside the server entry.
// Nitro picks its preset from the environment, and each preset writes somewhere
// different: `node-server` locally produces .output/server/index.mjs, while on
// Vercel the `vercel` preset produces .vercel/output/functions/__server.func/
// index.mjs instead. Watch every layout a build here can produce — a guard that
// only knows one of them waits the full BUILD_EXIT_MAX_MS for a file that is
// never written, then fails the build (30 idle minutes on every deploy).
const OUTPUTS = [
  { dir: './.output/', entry: 'server/index.mjs' },
  { dir: './.vercel/output/', entry: 'functions/__server.func/index.mjs' },
].map(({ dir, entry }) => {
  const base = fileURLToPath(new URL(dir, import.meta.url));
  return { manifest: `${base}nitro.json`, entry: `${base}${entry}` };
});
const BUILD_EXIT_POLL_MS = 500;
const BUILD_EXIT_MAX_MS = 30 * 60_000;
const buildStartedAt = Date.now();
let buildExitTimer: ReturnType<typeof setTimeout> | undefined;

function exitWhenNitroHasWritten() {
  if (buildExitTimer) clearTimeout(buildExitTimer);
  buildExitTimer = setTimeout(() => {
    // Nitro writes its manifest last, so a manifest newer than this build,
    // sitting beside a server entry, means the output is complete.
    const done = OUTPUTS.some(
      ({ manifest, entry }) =>
        existsSync(entry) && existsSync(manifest) && statSync(manifest).mtimeMs > buildStartedAt,
    );
    if (done) {
      // Let the last file handles flush, then leave.
      setTimeout(() => process.exit(0), 1000);
      return;
    }
    if (Date.now() - buildStartedAt > BUILD_EXIT_MAX_MS) {
      console.error(
        `[tanstack-build-exit] no Nitro output appeared at ${OUTPUTS.map((o) => o.entry).join(' or ')}; giving up.`,
      );
      process.exit(1);
    }
    exitWhenNitroHasWritten();
  }, BUILD_EXIT_POLL_MS);
}

export default defineConfig({
  nitro: {
    // Keep react/react-dom + MF runtime as Node externals so all server-side
    // code shares one require() module instance (hooks/context stay intact).
    traceDeps: [
      'react',
      'react-dom',
      '@module-federation/runtime',
      '@module-federation/runtime-core',
      '@module-federation/sdk',
    ],
    // Blog content changes without a deploy: serve cached HTML for 60 s and
    // revalidate in the background (Vercel maps swr to ISR; node-server caches in memory).
    routeRules: {
      '/': { swr: 60 },
      '/blog': { swr: 60 },
      '/blog/**': { swr: 60 },
    },
  },
  plugins: [
    federation({
      dts: false,
      name: 'portfolio',
      // TanStack Start has no index.html — inject host init into the entry.
      hostInitInjectLocation: 'entry',
      remotes: {
        toonhub: {
          type: 'module',
          name: 'toonhub',
          entry: TOONHUB_REMOTE,
        },
        mindloop: {
          type: 'module',
          name: 'mindloop',
          entry: MINDLOOP_REMOTE,
        },
        immersive_ocean: {
          type: 'module',
          name: 'immersive_ocean',
          entry: IMMERSIVE_OCEAN_REMOTE,
        },
        viktor: {
          type: 'module',
          name: 'viktor',
          entry: VIKTOR_REMOTE,
        },
        bali: {
          type: 'module',
          name: 'bali',
          entry: BALI_REMOTE,
        },
        profile: {
          type: 'module',
          name: 'profile',
          entry: PROFILE_REMOTE,
        },
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
      // `loaded-first`: resolve shared packages from what is already loaded (the
      // host's React) instead of `version-first`, which eagerly loads EVERY
      // registered remote's entry at host init to negotiate versions. On the
      // server that init hangs forever if a single remote is unreachable, taking
      // every SSR request down with it. Remotes bundle their own React anyway.
      shareStrategy: 'loaded-first',
    }),
    tanstackStart(),
    react(),
    nitro(),
    {
      // See exitWhenNitroHasWritten(): exit once Nitro's server bundle is on disk.
      name: 'tanstack-build-exit',
      apply: 'build',
      writeBundle() {
        exitWhenNitroHasWritten();
      },
    },
  ],
  ssr: {
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
  },
  define: {
    'import.meta.env.VITE_TOONHUB_ORIGIN': JSON.stringify(TOONHUB_ORIGIN),
  },
  build: {
    target: 'chrome89',
  },
  server: {
    port: PORTFOLIO_PORT,
  },
});
