import { afterEach, describe, expect, it, vi } from 'vitest';

// The module imports the federation plugin at top level; stub it so the unit
// test doesn't pull the real Vite plugin graph. The stub keeps the options it
// was given, which is what defineRemote decides.
const federation = vi.hoisted(() =>
  vi.fn((options: object) => ({ name: 'mock-federation', options })),
);
vi.mock('@module-federation/vite', () => ({ federation }));

import { defineRemote, env } from './index';

const KEY = 'NCAM_TEST_ENV_VAR';

describe('env()', () => {
  afterEach(() => {
    delete process.env[KEY];
  });

  it('prefers the real process environment over the fallback', () => {
    process.env[KEY] = 'from-process';
    expect(env(KEY, 'fallback')).toBe('from-process');
  });

  it('uses the provided fallback when the key is unset everywhere', () => {
    expect(env(KEY, 'fallback')).toBe('fallback');
  });

  it('returns an empty string when unset and no fallback is given', () => {
    expect(env(KEY)).toBe('');
  });
});

describe('defineRemote()', () => {
  const remote = () =>
    defineRemote({ name: 'probe', port: 9999, exposes: { './mount': './src/mount.ts' } });

  it('generates no federated types, in dev or in a build', () => {
    // The host types its remotes by hand (apps/portfolio/src/types/remote)
    // and consumes none. Generating them ran a full tsc for every file event a
    // dev server saw, all at once: a build's writes into dist-ssr, watched by
    // two dev servers, spawned about 400 and took the machine down.
    remote();
    expect(federation).toHaveBeenLastCalledWith(expect.objectContaining({ dts: false }));
  });

  it('keeps the SSR build output out of the dev server’s watcher', () => {
    // Vite ignores the client outDir (dist) by itself, but not the ssr
    // environment's, so a build flooded every dev server watching the app.
    expect(remote().server?.watch?.ignored).toContain('**/dist-ssr/**');
  });
});
