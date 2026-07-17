import { federation } from '@module-federation/vite';
import { env } from '@ncam/mf-remote';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
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
const PORTFOLIO_PORT = Number(env('PORTFOLIO_PORT', '9000'));

let buildExitTimer: ReturnType<typeof setTimeout> | undefined;

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
      // Nitro can leave a handle open during closeBundle; exit once writes settle.
      name: 'tanstack-build-exit',
      apply: 'build',
      writeBundle() {
        if (buildExitTimer) clearTimeout(buildExitTimer);
        buildExitTimer = setTimeout(() => process.exit(0), 1000);
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
