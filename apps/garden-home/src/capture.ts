// Capture mode (scripts/capture-poster.mjs), read from the standalone page's query only: the
// federated mount never sees it. ?capture=landscape|portrait renders the site route's scene alone,
// with no UI, at POSTER_SEARCH (src/capture-view.tsx).

export const POSTER_SHAPES = ['landscape', 'portrait'] as const;
export type PosterShape = (typeof POSTER_SHAPES)[number];

/** The poster's moment: 10:00 like the source's poster, full quality, the island centred. */
export const POSTER_SEARCH = '?t=10:00&quality=high&align=center';

export function parseCapture(search: string): PosterShape | null {
  const value = new URLSearchParams(search).get('capture');
  return POSTER_SHAPES.find((shape) => shape === value) ?? null;
}
