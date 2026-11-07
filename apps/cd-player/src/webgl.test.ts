import { describe, expect, it, vi } from 'vitest';
import { hasWebGL2, type ProbeCanvas, type ProbeContext } from './webgl';

const canvasWith = (context: ProbeContext | null): ProbeCanvas => ({ getContext: () => context });

describe('hasWebGL2', () => {
  it('says yes when the browser hands out a WebGL 2 context, and releases the probe', () => {
    const loseContext = vi.fn();
    const getContext = vi.fn(() => ({ getExtension: () => ({ loseContext }) }));
    expect(hasWebGL2(() => ({ getContext }))).toBe(true);
    expect(getContext).toHaveBeenCalledWith('webgl2');
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('still says yes when the context cannot be released by hand', () => {
    expect(hasWebGL2(() => canvasWith({ getExtension: () => null }))).toBe(true);
  });

  it('says no without a WebGL 2 context, or when asking for one throws', () => {
    expect(hasWebGL2(() => canvasWith(null))).toBe(false);
    expect(
      hasWebGL2(() => ({
        getContext: () => {
          throw new Error('blocked');
        },
      })),
    ).toBe(false);
  });
});
