import { afterEach, describe, expect, it, vi } from 'vitest';

// The module imports the federation plugin at top level; stub it so the unit
// test doesn't pull the real Vite plugin graph.
vi.mock('@module-federation/vite', () => ({ federation: () => ({ name: 'mock-federation' }) }));

import { env } from './index';

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
