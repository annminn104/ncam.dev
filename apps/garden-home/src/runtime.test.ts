import { describe, expect, it } from 'vitest';
import type { Params } from './params';
import { resolveRuntime } from './runtime';

const none: Params = { t: null, quality: null, fps: null, debug: false, align: null, bg: null };

describe('resolveRuntime', () => {
  it('wallpaper: medium, 30 fps, dpr <= 1.5, 1024 shadow updated on demand', () => {
    expect(resolveRuntime('/wallpaper', none, 2, false)).toEqual({
      route: 'wallpaper',
      quality: 'medium',
      fps: 30,
      dpr: 1.5,
      shadowMapSize: 1024,
      shadowAutoUpdate: false,
      align: 'right',
    });
  });

  it('site on desktop: high, 60 fps, dpr <= 2, 2048 shadow every frame', () => {
    expect(resolveRuntime('/', none, 3, false)).toEqual({
      route: 'site',
      quality: 'high',
      fps: 60,
      dpr: 2,
      shadowMapSize: 2048,
      shadowAutoUpdate: true,
      align: 'center',
    });
  });

  it('site on touch devices drops to medium', () => {
    expect(resolveRuntime('/', none, 3, true).quality).toBe('medium');
  });

  it('treats a trailing slash as the wallpaper route', () => {
    expect(resolveRuntime('/wallpaper/', none, 2, false).route).toBe('wallpaper');
  });

  it('lets URL params override quality and fps', () => {
    const tuned = resolveRuntime('/wallpaper', { ...none, quality: 'high', fps: 20 }, 2, false);
    expect([tuned.quality, tuned.fps]).toEqual(['high', 20]);
  });

  it('frames the wallpaper on the right and the site in the middle unless ?align= says otherwise', () => {
    expect(resolveRuntime('/wallpaper', { ...none, align: 'left' }, 2, false).align).toBe('left');
    expect(resolveRuntime('/', { ...none, align: 'right' }, 2, false).align).toBe('right');
    expect(resolveRuntime('/wallpaper', { ...none, align: 'center' }, 2, false).align).toBe(
      'center',
    );
  });

  it('keeps low-dpi screens at their own ratio', () => {
    expect(resolveRuntime('/wallpaper', none, 1, false).dpr).toBe(1);
  });
});
