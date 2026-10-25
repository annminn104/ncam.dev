// Capture mode (scripts/capture-poster.mjs), read from the standalone page's query only: the
// federated mount never sees it. ?capture=landscape|portrait boots the engine at once, with no UI
// and the scene clock pinned at POSTER_TIME (src/capture-view.ts).

export const POSTER_SHAPES = ['landscape', 'portrait'] as const;
export type PosterShape = (typeof POSTER_SHAPES)[number];

/** Scene clock (seconds) for the poster: all four rides on screen, spread along the street. */
export const POSTER_TIME = 7;

/** Frames drawn after the engine's first before a capture counts as settled. */
export const SETTLE_FRAMES = 3;

export function parseCapture(search: string): PosterShape | null {
  const value = new URLSearchParams(search).get('capture');
  return POSTER_SHAPES.find((shape) => shape === value) ?? null;
}
