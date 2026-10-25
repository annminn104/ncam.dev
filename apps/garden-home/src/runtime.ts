import type { Align, Params, Quality } from './params';

export interface RuntimeConfig {
  route: 'site' | 'wallpaper';
  quality: Quality;
  fps: number;
  dpr: number;
  shadowMapSize: number;
  shadowAutoUpdate: boolean;
  align: Align;
}

/** Per-route render settings (spec §10). URL params override quality, fps and align. */
export function resolveRuntime(
  pathname: string,
  params: Params,
  devicePixelRatio: number,
  coarsePointer: boolean,
): RuntimeConfig {
  const wallpaper = pathname.replace(/\/+$/, '') === '/wallpaper';
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
