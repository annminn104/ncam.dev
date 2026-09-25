import type { Effect } from '../shader/types';
import { COVER, WHITE, fixedFilter, grey, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';
import { SUNPILLAR } from './palette';

/** radiant-holo.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1, contrast: 1.5 };

/**
 * A radiant rare. The shine is derived by eye from pokemon-cards-css; the
 * glare is ported from radiant-holo.css, hard-lit, beneath the shine
 * (legacy-glare.ts).
 */
export const radiantHolo: Effect = {
  id: 'radiant-holo',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 45, space: 0.02, stops: SUNPILLAR },
          blend: 'normal',
          size: [5, 5],
          offset: { x: { base: 0, fromLeft: 1.2 }, y: { base: 0, fromTop: 1.2 } },
        },
        {
          source: { kind: 'repeating-linear', angleDeg: -45, space: 0.03, stops: SUNPILLAR },
          blend: 'hard-light',
          size: [5, 5],
          offset: { x: { base: 0, fromLeft: -1 }, y: { base: 0, fromTop: 1 } },
        },
      ],
      filter: {
        brightness: { base: 0.5, fromCenter: 0.35 },
        contrast: { base: 2.4 },
        saturate: { base: 1.5 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.5, fromCenter: 0.4 },
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(WHITE, 0, 0.33), stop(grey(0.25), 110)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
