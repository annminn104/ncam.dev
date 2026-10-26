import type { Align, Params, Quality } from './params';

export type Route = 'site' | 'wallpaper';

export interface RuntimeConfig {
  route: Route;
  quality: Quality;
  fps: number;
  dpr: number;
  shadowMapSize: number;
  shadowAutoUpdate: boolean;
  align: Align;
}

/**
 * Per-route render settings. URL params override quality, fps and align. The host always
 * renders the site route; the standalone page picks the route from its path (src/routes.ts).
 */
export function resolveRuntime(
  route: Route,
  params: Params,
  devicePixelRatio: number,
  coarsePointer: boolean,
): RuntimeConfig {
  const wallpaper = route === 'wallpaper';
  return {
    route: wallpaper ? 'wallpaper' : 'site',
    quality: params.quality ?? (wallpaper || coarsePointer ? 'medium' : 'high'),
    fps: params.fps ?? (wallpaper ? 30 : 60),
    dpr: Math.min(wallpaper ? 1.5 : 2, devicePixelRatio),
    shadowMapSize: wallpaper ? 1024 : 2048,
    shadowAutoUpdate: !wallpaper,
    // On the desktop the island floats on the right half, the background (sky or ?bg= photo) fills the rest.
    align: params.align ?? (wallpaper ? 'right' : 'center'),
  };
}
