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
const PORTFOLIO_PORT = Number(env('PORTFOLIO_PORT', '9000'));

// Nitro leaves a handle open after its build, so `vite build` never exits on its
// own. Exiting on a fixed delay after `writeBundle` raced the SSR + Nitro server
// build on slow machines (an emulated Docker VM shipped an image with an empty
// .output/server). Nitro writes its manifest last, so exit only once a manifest
// newer than this build exists alongside the server entry.
const OUTPUT_DIR = fileURLToPath(new URL('./.output/', import.meta.url));
const NITRO_MANIFEST = `${OUTPUT_DIR}nitro.json`;
const SERVER_ENTRY = `${OUTPUT_DIR}server/index.mjs`;
const BUILD_EXIT_POLL_MS = 500;
const BUILD_EXIT_MAX_MS = 30 * 60_000;
const buildStartedAt = Date.now();
let buildExitTimer: ReturnType<typeof setTimeout> | undefined;

function exitWhenNitroHasWritten() {
  if (buildExitTimer) clearTimeout(buildExitTimer);
  buildExitTimer = setTimeout(() => {
    const done =
      existsSync(SERVER_ENTRY) &&
      existsSync(NITRO_MANIFEST) &&
      statSync(NITRO_MANIFEST).mtimeMs > buildStartedAt;
    if (done) {
      // Let the last file handles flush, then leave.
      setTimeout(() => process.exit(0), 1000);
      return;
    }
    if (Date.now() - buildStartedAt > BUILD_EXIT_MAX_MS) {
      console.error(`[tanstack-build-exit] ${SERVER_ENTRY} never appeared; giving up.`);
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
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
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
