import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { federation } from '@module-federation/vite';
import { parse as parseDotenv } from 'dotenv';
import { defineConfig, type PluginOption, type UserConfig } from 'vite';

export type { MountConfig, MountHandle } from './contract';

/** Walk up from `start` to the monorepo root (where pnpm-workspace.yaml lives). */
function findMonorepoRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return start;
}

let fileEnvCache: Record<string, string> | undefined;

/** Merged root `.env` then `.env.local` (local overrides base). File layer only. */
export function loadRootEnv(): Record<string, string> {
  if (fileEnvCache) return fileEnvCache;
  const root = findMonorepoRoot();
  const merged: Record<string, string> = {};
  for (const file of ['.env', '.env.local']) {
    const path = join(root, file);
    if (existsSync(path)) Object.assign(merged, parseDotenv(readFileSync(path)));
  }
  fileEnvCache = merged;
  return merged;
}

/**
 * Resolve a config value with precedence: real environment (shell / docker / CI)
 * > `.env.local` > `.env` > `fallback`.
 */
export function env(key: string, fallback = ''): string {
  return process.env[key] ?? loadRootEnv()[key] ?? fallback;
}

/** The plugin's own remote-entry filename; the SSR sibling is derived from it. */
const REMOTE_ENTRY_FILENAME = 'remoteEntry.js';

/**
 * Rollup input for the remote's **SSR** entry.
 *
 * `@module-federation/vite` emits `remoteEntry.ssr.js` only when a build runs an
 * `ssr` environment — its `isSsrRemoteEntryBuild()` gate is closed for a
 * client-only build, silently and without a warning, which is why a remote built
 * as a plain SPA can never be server-rendered by the host. The `ssr` environment
 * in turn needs an explicit input: left to inherit `index.html` the build dies
 * with "rolldownOptions.input should not be an html file when building for SSR".
 *
 * The right input is the plugin's own virtual module, but neither
 * `getRemoteEntrySSRId()` nor its `REMOTE_ENTRY_SSR_ID` constant is exported, so
 * the id is reconstructed here exactly as `lib/index.js` builds it:
 * `virtual:mf-REMOTE_ENTRY_SSR_ID:` + `${internalName}__${filename}`, sanitised,
 * where `internalName` is the remote name behind the `__mfe_internal__` prefix.
 *
 * Verified against 1.21.5. If a future release renames any of those, the ssr
 * build fails loudly with an unresolved input rather than silently regressing to
 * client-only — which is the failure mode worth having.
 */
function ssrRemoteEntryInput(name: string, filename = REMOTE_ENTRY_FILENAME): string {
  const scopeKey = `__mfe_internal__${name}__${filename}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `virtual:mf-REMOTE_ENTRY_SSR_ID:${scopeKey}`;
}

export interface RemoteOptions {
  /** Module Federation remote name, e.g. 'mindloop'. Must be a valid identifier. */
  name: string;
  /** Default dev + preview port; overridable via the `<NAME>_PORT` env var. */
  port: number;
  /** Exposed modules, e.g. `{ './mount': './src/mount.tsx' }`. */
  exposes: Record<string, string>;
  /** Framework plugins (e.g. `react()`, `tailwindcss()`); prepended before federation. */
  plugins?: PluginOption[];
  /** Env var to override `base`; defaults to `<NAME>_BASE`. */
  baseEnv?: string;
}

/**
 * Shared Vite config for a framework-agnostic Module Federation **remote**.
 *
 * Every remote is self-contained: `shared: {}` means it bundles its own runtime
 * (including React, if it uses it) and exposes a `mount(el) => dispose` black
 * box. Nothing is shared across the host boundary, so there are no shared
 * singleton version/init races (e.g. React 19's "reading 'S'"): the remote runs
 * identically standalone and when mounted by the host — the same model that
 * makes `toonhub` robust.
 *
 * Port and base come from the root `.env` (`<NAME>_PORT`, `<NAME>_BASE`), so
 * hosts/ports are configured in one place.
 */
export function defineRemote({
  name,
  port,
  exposes,
  plugins = [],
  baseEnv,
}: RemoteOptions): UserConfig {
  const key = name.toUpperCase(); // mindloop → MINDLOOP, immersive_ocean → IMMERSIVE_OCEAN
  const resolvedPort = Number(env(`${key}_PORT`, String(port)));
  const base = env(baseEnv ?? `${key}_BASE`, '/') || '/';

  return defineConfig({
    // Absolute base so federated asset URLs resolve to this remote's origin.
    base,
    server: {
      port: resolvedPort,
      strictPort: true,
      cors: true,
      origin: `http://localhost:${resolvedPort}`,
    },
    preview: {
      port: resolvedPort,
      strictPort: true,
      cors: true,
    },
    build: {
      // Module Federation (top-level await) requires a modern target.
      target: 'esnext',
      modulePreload: false,
    },
    // Second build environment whose only job is to emit `remoteEntry.ssr.js`
    // and the Node-targeted copy of every exposed module. `vite build` alone
    // builds the client environment only, so the remote's build script must run
    // `vite build --app`; the plugin's `publishSsrOutputFiles()` then copies the
    // whole SSR graph into the client `outDir`, which is what makes it servable
    // from static hosting (Vercel) next to the browser entry. The host's
    // ssrEntryLoader finds it by convention: remoteEntry.js → remoteEntry.ssr.js.
    environments: {
      ssr: {
        // Bundle the remote's dependencies into the SSR graph instead of
        // leaving them as bare imports. The host evaluates this graph with the
        // `vm` strategy, which links bare specifiers through ITS share scope —
        // so anything the host does not share (lucide-react, gsap, framer-motion
        // …) fails with ERR_MODULE_NOT_FOUND and that section falls back to
        // client-only.
        //
        // React stays external on purpose. The host has it, so the vm links it
        // fine, and bundling it instead drags in react-dom/server's Node build,
        // whose `createRequire(import.meta.url)` throws under vm — there
        // `import.meta.url` is the remote's http:// URL, not a file path.
        resolve: {
          noExternal: true,
          external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime'],
        },
        build: {
          ssr: true,
          target: 'esnext',
          outDir: 'dist-ssr',
          emptyOutDir: true,
          rollupOptions: { input: { remoteEntrySsr: ssrRemoteEntryInput(name) } },
        },
      },
    },
    plugins: [
      ...plugins,
      federation({
        name,
        filename: REMOTE_ENTRY_FILENAME,
        exposes,
        // Self-contained: no shared singletons across the boundary.
        shared: {},
      }),
    ],
  }) as UserConfig;
}
