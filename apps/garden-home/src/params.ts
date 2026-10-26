export type Quality = 'high' | 'medium';
export type Align = 'left' | 'center' | 'right';

export interface TimeOverride {
  hours: number;
  minutes: number;
}

export interface Params {
  t: TimeOverride | null;
  quality: Quality | null;
  fps: number | null;
  debug: boolean;
  /** Where the scene sits across the screen; null leaves it to the route (resolveRuntime). */
  align: Align | null;
  /** URL of the background image under /backgrounds/, or null for the sky. */
  bg: string | null;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
/**
 * A plain file name in public/backgrounds/: no path, no query, one of the image types every browser decodes, in any
 * case of extension (IMG_1234.JPG as the camera wrote it).
 */
const BACKGROUND = /^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i;
export const BACKGROUNDS_URL = '/backgrounds/';

/**
 * URL tuning knobs: ?t=HH:MM, ?quality=high|medium, ?fps=N, ?debug=1, ?align=left|center|right and
 * ?bg=<file> (an image in public/backgrounds/ shown behind the island instead of the sky).
 */
export function parseParams(search: string): Params {
  const query = new URLSearchParams(search);
  const time = HHMM.exec(query.get('t') ?? '');
  const quality = query.get('quality');
  const fps = Number(query.get('fps'));
  const align = query.get('align');
  const bg = query.get('bg') ?? '';
  const background = BACKGROUND.test(bg);
  if (bg && !background) {
    console.warn(
      `?bg=${bg} ignored: it must be a plain file name in public/backgrounds/ ending in .jpg, .jpeg, .png or .webp`,
    );
  }
  return {
    t: time ? { hours: Number(time[1]), minutes: Number(time[2]) } : null,
    quality: quality === 'high' || quality === 'medium' ? quality : null,
    fps: Number.isFinite(fps) && fps >= 1 && fps <= 120 ? Math.round(fps) : null,
    debug: query.get('debug') === '1',
    align: align === 'left' || align === 'center' || align === 'right' ? align : null,
    bg: background ? BACKGROUNDS_URL + bg : null,
  };
}
