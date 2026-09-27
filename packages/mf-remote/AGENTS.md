# AGENTS.md — @ncam/mf-remote

The build-time helpers every federation **remote** shares, plus the host ↔
remote contract types. Ships raw TypeScript (`src/index.ts` is the entry): each
remote's `vite.config.ts` imports `defineRemote()`, the host's reads `env()`,
and both sides import the contract types.

## API

```ts
import { defineRemote, env } from '@ncam/mf-remote';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';

export default defineRemote({
  name: 'viktor', // federation name; env keys VIKTOR_PORT, VIKTOR_BASE
  port: 9004, // default dev/preview port, overridden by <NAME>_PORT
  exposes: {
    './mount': './src/mount.tsx',
    './ssr': './src/ssr.tsx',
    './hydrate': './src/hydrate.tsx',
  },
  plugins: [react(), tailwindcss()], // prepended before the federation plugin
  // baseEnv: 'VIKTOR_BASE', // env var for `base`; defaults to <NAME>_BASE
});

env('HOLODEX_REMOTE_URL', 'http://localhost:9007/remoteEntry.js');
// real environment > .env.local > .env > fallback (files read from the monorepo root)
```

`defineRemote()` returns a remote's whole Vite config:

- `base` from `<NAME>_BASE` (default `/`);
- dev and preview `port` from `<NAME>_PORT`, with `strictPort` and `cors`. The
  dev server's `origin` is `http://localhost:<port>` from that same variable, so
  a second dev server on another port needs `<NAME>_PORT`, not just `--port`,
  or its asset URLs point at the first one;
- `server.watch.ignored: ['**/dist-ssr/**']`;
- `build.target: 'esnext'` and `modulePreload: false` (Module Federation uses
  top-level await);
- an `ssr` build environment that emits `remoteEntry.ssr.js` and a Node copy of
  every exposed module into `dist-ssr`, which the plugin then publishes next to
  the browser entry;
- the federation plugin with `filename: 'remoteEntry.js'`, `shared: {}` and
  `dts: false`.

`src/contract.ts` holds `MountConfig` (`route`, `onNavigate`, `assetBase`) and
`MountHandle` (a disposer with an optional `update(route)`).

## Rules

- **Every remote builds with `vite build --app`.** Plain `vite build` skips the
  `ssr` environment without a warning: the remote then has no
  `remoteEntry.ssr.js`, and the host can only mount it on the client.
- **Keep `shared: {}`.** Each remote bundles its own runtime, React included,
  and behaves the same standalone and mounted.
- **Keep `dts: false`.** The plugin's generated types run a full `tsc` for every
  file event a dev server sees, all at once and never debounced; builds writing
  into `dist-ssr` once spawned about 400 of them and took the machine down. The
  host types its remotes by hand in `apps/portfolio/src/types/remote/`.
- **SSR externals.** The `ssr` environment bundles every dependency except
  React (`react`, `react-dom`, `react-dom/server`, `react/jsx-runtime`). The
  host evaluates the graph with the `vm` strategy and links bare imports
  through its own share scope, so anything else left external fails with
  `ERR_MODULE_NOT_FOUND`, while bundling React breaks `react-dom/server` under
  `vm`.
- `ssrRemoteEntryInput()` rebuilds the plugin's private virtual-module id for
  the SSR entry (verified against `@module-federation/vite` 1.21.5). A release
  that renames it makes the `ssr` build fail with an unresolved input: update
  the id then, and don't drop the environment.
- `contract.ts` stays types-only, so importing it adds nothing to a bundle.
- A change here reaches all seven remotes: rebuild them, and check that the host
  still mounts and server-renders them.

## Verify

`src/index.test.ts` stubs the federation plugin and checks what `defineRemote()`
and `env()` decide.

```bash
pnpm --filter @ncam/mf-remote typecheck
pnpm test    # includes packages/mf-remote
pnpm build   # every remote, through `vite build --app`
```
