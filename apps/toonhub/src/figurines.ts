/**
 * How the figurine images are published and picked, shared by the markup
 * (hero-template.ts) and the controller that later widens the side ones.
 * scripts/download-assets.mjs derives the files, from the PNG sources in
 * `assets/figurines/`, as `<image>-<width>.<format>`.
 */

/** Widths every figurine is published at. */
export const FIGURINE_WIDTHS = [240, 480, 720, 960, 1440, 1920] as const;

/** Formats, best first: AVIF (~40% under WebP here), then WebP for the rest. */
export const FIGURINE_FORMATS = ['avif', 'webp'] as const;
export type FigurineFormat = (typeof FIGURINE_FORMATS)[number];

/** The `src` for a browser that ignores `srcset` (a WebP): a desktop's pick at 1x. */
export const FALLBACK_WIDTH = 960;

/**
 * How wide the centre figurine draws. Its box is 0.6 of its height, a share of
 * the hero's viewport-tall height, then scaled (hero.css): 86% × 1.42 on a
 * short screen (phones included), 60% × 1.25 on a narrow one, else 92% × 1.68.
 */
export const CENTER_SIZES = '(max-height: 700px) 74vh, (max-width: 640px) 45vh, 93vh';

/**
 * How wide a side figurine draws (left and right; the one behind is smaller):
 * what it is fetched at on first paint, so three small files leave the network
 * to the centre one, the page's LCP. The controller then asks every figurine
 * for its centre size, since each takes that role in turn.
 */
export const SIDE_SIZES = '(max-width: 640px) 10vh, 17vh';

/** `image`'s srcset in `format`: every published width. */
export function figurineSrcset(image: string, format: FigurineFormat): string {
  return FIGURINE_WIDTHS.map((width) => `${image}-${width}.${format} ${width}w`).join(', ');
}
