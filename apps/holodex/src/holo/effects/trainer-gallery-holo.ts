import type { Effect } from '../shader/types';
import { COVER, WHITE, hsl, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';
import { SUNPILLAR } from './palette';

/**
 * A trainer gallery holo. The shine is derived by eye from pokemon-cards-css;
 * the glare is ported from trainer-gallery-holo.css, soft-lit, with no filter
 * and its :before and :after switched off, beneath the shine
 * (legacy-glare.ts). trainer-gallery-v-regular and trainer-gallery-v-max
 * spread this effect but paint glares of their own.
 */
export const trainerGalleryHolo: Effect = {
  id: 'trainer-gallery-holo',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 120, space: 0.06, stops: SUNPILLAR },
          blend: 'normal',
          size: [2, 2],
          offset: { x: { base: 0, fromLeft: 0.7 }, y: { base: 0, fromTop: 0.7 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.25 },
        contrast: { base: 1.5 },
        saturate: { base: 1 },
      },
      mixBlend: 'hard-light',
      opacity: { base: 0.3, fromCenter: 0.35 },
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(WHITE, 10), stop(WHITE, 35, 0.6), stop(hsl(180, 11, 35), 60)],
            COVER,
            glareNeutral('soft-light'),
          ),
          blend: 'normal',
        },
      ],
      mixBlend: 'soft-light',
    },
  ],
  glare: [],
};
