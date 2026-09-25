import type { Effect } from '../shader/types';
import { BLACK, COVER, WHITE, fixedFilter, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';
import { SUNPILLAR } from './palette';

/** v-max.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1, contrast: 1 };

/**
 * A VMAX. The shine is derived by eye from pokemon-cards-css; the glare is
 * ported from v-max.css, hard-lit, beneath the shine (legacy-glare.ts), a
 * fifth strong at the middle and rising as the pointer leaves it.
 */
export const vMax: Effect = {
  id: 'v-max',
  shine: [
    {
      layers: [
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: -33,
            space: 0.06,
            stops: [
              [0.83, 0.16, 0.13],
              [0.42, 0.48, 0.85],
              [0.24, 0.79, 0.62],
              [0.93, 0.83, 0.26],
            ],
          },
          blend: 'normal',
          size: [6, 6],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
        { source: { kind: 'grain', scale: 3 }, blend: 'soft-light' },
      ],
      filter: {
        brightness: { base: 0.4, fromCenter: 0.4 },
        contrast: { base: 2 },
        saturate: { base: 1 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.5, fromCenter: 0.35 },
    },
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 0, space: 0.05, stops: SUNPILLAR },
          // The first layer of an element has nothing beneath it, so its blend is ignored — the same reason CSS ignores it.
          blend: 'normal',
          size: [2, 7],
          offset: { x: { base: 0 }, y: { base: 0, fromTop: 1 } },
        },
      ],
      filter: { saturate: { base: 1.5 } },
      mixBlend: 'lighten',
      opacity: { base: 0.3, fromCenter: 0.5 },
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(WHITE, 0, 0.75), stop(BLACK, 120)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc((0.2 * var(--card-opacity)) + var(--card-opacity) * var(--pointer-from-center) * 0.8)
      opacity: { base: 0.2, fromCenter: 0.8 },
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
