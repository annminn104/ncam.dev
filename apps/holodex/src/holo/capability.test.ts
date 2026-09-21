import { describe, expect, it, vi } from 'vitest';
import { supportsHolo } from './capability';

const ok = {
  matchMedia: () => ({ matches: false }),
  hardwareConcurrency: 8,
  createContext: () => ({}),
};

describe('supportsHolo', () => {
  it('allows a capable browser', () => {
    expect(supportsHolo(ok)).toBe(true);
  });

  it('refuses when the visitor asked for reduced motion', () => {
    expect(supportsHolo({ ...ok, matchMedia: () => ({ matches: true }) })).toBe(false);
  });

  it('refuses on a low-core device', () => {
    expect(supportsHolo({ ...ok, hardwareConcurrency: 2 })).toBe(false);
  });

  it('refuses when no WebGL2 context can be made', () => {
    expect(supportsHolo({ ...ok, createContext: () => null })).toBe(false);
  });

  it('refuses instead of throwing when the context probe throws', () => {
    expect(
      supportsHolo({
        ...ok,
        createContext: () => {
          throw new Error('context creation blocked');
        },
      }),
    ).toBe(false);
  });

  it('refuses when there is nothing to probe with (SSR)', () => {
    expect(supportsHolo({})).toBe(false);
  });

  it('asks matchMedia the reduced-motion question', () => {
    const matchMedia = vi.fn(() => ({ matches: false }));
    supportsHolo({ ...ok, matchMedia });
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});
