import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserProbe, supportsHolo } from './capability';

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

describe('browserProbe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty probe when there is no DOM (SSR)', () => {
    expect(browserProbe()).toEqual({});
  });

  it('releases the WebGL2 context it opens to answer the question', () => {
    // HoloCard probes once per mount, and this used to leak a live context
    // each time. Chrome caps live contexts near 16 and evicts the oldest, so
    // a grid of cards could knock out its own earlier canvases just by asking
    // whether WebGL works — driving the app straight into its own
    // holo.context-lost fallback. The probe must hand the context back and
    // report only the verdict.
    const loseContext = vi.fn();
    const gl = { getExtension: vi.fn(() => ({ loseContext })) };
    const getContext = vi.fn(() => gl);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 });
    vi.stubGlobal('document', { createElement: () => ({ getContext }) });

    const probe = browserProbe();
    expect(probe.createContext?.()).toBe(true);
    expect(getContext).toHaveBeenCalledWith('webgl2');
    expect(gl.getExtension).toHaveBeenCalledWith('WEBGL_lose_context');
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('still reports false when no context can be made, without touching it', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 });
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });

    const probe = browserProbe();
    expect(probe.createContext?.()).toBe(false);
    expect(supportsHolo(probe)).toBe(false);
  });
});
