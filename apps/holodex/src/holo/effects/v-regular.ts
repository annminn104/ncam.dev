import type { Effect } from '../shader/types';
import { COVER, WHITE, fixedFilter, grey, hsl, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';
import { SUNPILLAR } from './palette';

/** v-regular.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 0.9, contrast: 1.75 };

/**
 * A V. The shine is derived by eye from pokemon-cards-css; the glare is ported
 * from v-regular.css, hard-lit at half strength, beneath the shine
 * (legacy-glare.ts).
 */
export const vRegular: Effect = {
  id: 'v-regular',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 133, space: 0.06, stops: SUNPILLAR },
          blend: 'normal',
          size: [2, 2],
          offset: { x: { base: 0, fromLeft: 0.8 }, y: { base: 0, fromTop: 0.8 } },
        },
      ],
      filter: {
        brightness: { base: 0.5, fromCenter: 0.3 },
        contrast: { base: 1.8 },
        saturate: { base: 1.1 },
      },
      mixBlend: 'soft-light',
      opacity: { base: 0.5, fromCenter: 0.35 },
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(WHITE, 0), stop(hsl(210, 3, 54), 45, 0.33), stop(grey(0.2), 130, 0.9)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      opacity: { base: 0.5 },
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
