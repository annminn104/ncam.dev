import type { Effect } from '../shader/types';
import { COVER, WHITE, fixedFilter, hsl, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';

/** shiny-rare.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1.2, contrast: 1, saturate: 0.7 };

/**
 * A shiny rare. The shine is derived by eye from pokemon-cards-css; the glare
 * is ported from shiny-rare.css, multiplied, beneath the shine
 * (legacy-glare.ts), and only as strong as the pointer is far from the middle.
 */
export const shinyRare: Effect = {
  id: 'shiny-rare',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 8 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 100,
            space: 0.04,
            stops: [
              [0.75, 0.85, 0.95],
              [0.35, 0.45, 0.6],
              [0.9, 0.92, 0.98],
            ],
          },
          blend: 'difference',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 0.9 }, y: { base: 0, fromTop: 0.9 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.3 },
        contrast: { base: 1.9 },
        saturate: { base: 0.8 },
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
            [stop(WHITE, 0), stop(hsl(320, 5, 15), 150)],
            COVER,
            glareNeutral('multiply', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--card-opacity) * var(--pointer-from-center))
      opacity: { base: 0, fromCenter: 1 },
      mixBlend: 'multiply',
    },
  ],
  glare: [],
};
