import type { Effect } from '../shader/types';
import { fixed, fixedFilter, radial } from './css';
import { BASE_GLARE, glareNeutral } from './legacy-glare';
import { SUNPILLAR } from './palette';

/** trainer-full-art.css's .card__glare filter, for a supporter. */
const GLARE_FILTER = { brightness: 1.5, contrast: 1.4, saturate: 1 };

/**
 * A full art trainer. The shine is derived by eye from pokemon-cards-css; the
 * glare is ported from trainer-full-art.css, which styles a supporter's:
 * base.css's radial drawn 170% of the card from its top left corner (it sets a
 * size and no position), multiplied, beneath the shine (legacy-glare.ts).
 */
export const trainerFullArt: Effect = {
  id: 'trainer-full-art',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 133, space: 0.07, stops: SUNPILLAR },
          blend: 'normal',
          size: [2.5, 2.5],
          offset: { x: { base: 0, fromLeft: 0.7 }, y: { base: 0, fromTop: 0.7 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.25 },
        contrast: { base: 1.5 },
        saturate: { base: 0.9 },
      },
      mixBlend: 'screen',
      opacity: { base: 0.3, fromCenter: 0.35 },
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            BASE_GLARE,
            { size: [1.7, 1.7], position: [fixed(0), fixed(0)] },
            glareNeutral('multiply', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      opacity: { base: 0.75 },
      mixBlend: 'multiply',
    },
  ],
  glare: [],
};
