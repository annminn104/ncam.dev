import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { WebglFallback, hasWebgl } from './WebglFallback';

/** A stand-in canvas that can give out only the context types listed. */
function fakeCanvas(supported: string[]) {
  const loseContext = vi.fn();
  const context = {
    getExtension: vi.fn((name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null)),
  };
  const getContext = vi.fn((type: string) => (supported.includes(type) ? context : null));
  return {
    canvas: { getContext } as unknown as HTMLCanvasElement,
    getContext,
    loseContext,
    context,
  };
}

describe('hasWebgl', () => {
  it('accepts a browser that can give WebGL 2, and hands the probe context back', () => {
    const { canvas, loseContext } = fakeCanvas(['webgl2', 'webgl']);
    expect(hasWebgl(() => canvas)).toBe(true);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('refuses a browser with WebGL 1 only: three builds WebGL 2 contexts and nothing else', () => {
    const { canvas, getContext } = fakeCanvas(['webgl']);
    expect(hasWebgl(() => canvas)).toBe(false);
    // It does not even ask for WebGL 1: that answer could only mislead.
    expect(getContext.mock.calls.map(([type]) => type)).toEqual(['webgl2']);
  });

  it('refuses a browser with no WebGL at all', () => {
    expect(hasWebgl(() => fakeCanvas([]).canvas)).toBe(false);
  });

  it('still says yes when the context cannot be given back', () => {
    const { canvas, context } = fakeCanvas(['webgl2']);
    context.getExtension.mockReturnValue(null);
    expect(hasWebgl(() => canvas)).toBe(true);
  });

  it('says no, rather than throwing, when the browser throws', () => {
    const throwing = {
      getContext: () => {
        throw new Error('blocked by policy');
      },
    } as unknown as HTMLCanvasElement;
    expect(hasWebgl(() => throwing)).toBe(false);
    expect(
      hasWebgl(() => {
        throw new Error('no document');
      }),
    ).toBe(false);
  });
});

describe('WebglFallback', () => {
  it('is an alert that explains the missing WebGL and leads back to the lobby', () => {
    const html = renderToString(createElement(WebglFallback, { onExit: () => {} }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('needs WebGL');
    expect(html).toContain('Back to the lobby');
  });
});
