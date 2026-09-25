import type { Effect } from '../shader/types';
import { CENTER, fixedFilter, grey, hsl, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';

/** shiny-v.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 0.88, contrast: 2.25, saturate: 0.7 };

/**
 * A shiny V. The shine is derived by eye from pokemon-cards-css; the glare is
 * ported from shiny-v.css, darkening, beneath the shine (legacy-glare.ts): a
 * radial in an image 120% × 140% of the card, centred on it, and only as
 * strong as the pointer is far from the middle.
 */
export const shinyV: Effect = {
  id: 'shiny-v',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 6 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 140,
            space: 0.05,
            stops: [
              [0.6, 0.78, 0.95],
              [0.22, 0.3, 0.5],
              [0.85, 0.9, 1],
            ],
          },
          blend: 'darken',
          size: [3.5, 3.5],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
      ],
      filter: {
        brightness: { base: 0.62, fromCenter: 0.28 },
        contrast: { base: 2 },
        saturate: { base: 0.9 },
      },
      mixBlend: 'exclusion',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(grey(0.9), 5), stop(hsl(200, 5, 45), 80), stop(hsl(320, 40, 10), 150)],
            { size: [1.2, 1.4], position: [CENTER, CENTER] },
            glareNeutral('darken', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--card-opacity) * var(--pointer-from-center) * 0.75)
      opacity: { base: 0, fromCenter: 0.75 },
      mixBlend: 'darken',
    },
  ],
  glare: [],
};
