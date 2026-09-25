import type { Effect } from '../shader/types';
import { BLACK, COVER, filterRGB, fixedFilter, grey, hsl, radial, stop, type RGB } from './css';
import { BASE_GLARE, glareNeutral } from './legacy-glare';

/** regular-holo.css's .card__glare filter, and its :after's own. */
const GLARE_FILTER = { brightness: 0.8, contrast: 1.5 };
const AFTER_FILTER = { brightness: 0.6, contrast: 3 };
const afterStop = (c: RGB, at: number, alpha = 1) => stop(filterRGB(c, AFTER_FILTER), at, alpha);

/**
 * Rare Holo: spectral bands over scanlines, clipped to the art window.
 *
 * The shine is derived by eye from pokemon-cards-css; the glare is ported from
 * regular-holo.css: base.css's radial and an :after radial overlaid onto it,
 * under the glare's own filter, painted beneath the shine (legacy-glare.ts).
 * Approximation: the reference clips the :after to the art window on stage,
 * supporter and item cards; here it covers the card.
 */
export const regularHolo: Effect = {
  id: 'regular-holo',
  shine: [
    {
      layers: [
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 110,
            space: 0.05,
            stops: [
              [0.79, 0.16, 0.95],
              [0.05, 0.74, 0.91],
              [0.13, 0.91, 0.52],
              [0.93, 0.87, 0.06],
              [0.97, 0.05, 0.21],
            ],
          },
          blend: 'normal',
          size: [2.2, 2.2],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
        {
          source: { kind: 'scanlines', spacing: 0.006, light: 0.4, dark: 0.0 },
          blend: 'overlay',
        },
      ],
      filter: {
        brightness: { base: 0.55, fromCenter: 0.35 },
        contrast: { base: 2.2 },
        saturate: { base: 1.4 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.45, fromCenter: 0.45 },
    },
  ],
  beneath: [
    {
      layers: [
        // .card__glare paints base.css's radial
        { ...radial(BASE_GLARE, COVER, glareNeutral('overlay', GLARE_FILTER)), blend: 'normal' },
        // and its :after, under its own filter, overlaid onto it
        {
          ...radial(
            [
              afterStop(hsl(180, 100, 95), 5),
              afterStop(grey(0.39), 55, 0.25),
              afterStop(BLACK, 110, 0.36),
            ],
            COVER,
            grey(0.5),
          ),
          blend: 'overlay',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      opacity: { base: 0.8 },
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
