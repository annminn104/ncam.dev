import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { federation } from '@module-federation/vite';
import { parse as parseDotenv } from 'dotenv';
import { defineConfig, type PluginOption, type UserConfig } from 'vite';

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
    plugins: [
      ...plugins,
      federation({
        name,
        filename: 'remoteEntry.js',
        exposes,
        // Self-contained: no shared singletons across the boundary.
        shared: {},
      }),
    ],
  }) as UserConfig;
}
