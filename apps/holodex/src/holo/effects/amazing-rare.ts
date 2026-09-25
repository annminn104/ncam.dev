import type { Effect } from '../shader/types';
import { BLACK, COVER, WHITE, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';
import { SUNPILLAR } from './palette';

/**
 * An amazing rare. The shine is derived by eye from pokemon-cards-css; the
 * glare is ported from amazing-rare.css's rule for a card with no mask, a
 * multiplied radial with no filter, beneath the shine (legacy-glare.ts). Its
 * masked rules, a second radial through the card's own mask, have nothing to
 * mask here and are left out.
 */
export const amazingRare: Effect = {
  id: 'amazing-rare',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 0, space: 0.03, stops: SUNPILLAR },
          blend: 'normal',
          size: [1, 6],
          offset: { x: { base: 0 }, y: { base: 0, fromTop: 1 } },
        },
        { source: { kind: 'grain', scale: 2 }, blend: 'saturation' },
      ],
      filter: {
        brightness: { base: 0.7, fromCenter: 0.3 },
        contrast: { base: 1.6 },
        saturate: { base: 1.8 },
      },
      mixBlend: 'lighten',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(WHITE, 10), stop(WHITE, 20, 0.85), stop(BLACK, 90, 0.35)],
            COVER,
            glareNeutral('multiply'),
          ),
          blend: 'normal',
        },
      ],
      mixBlend: 'multiply',
    },
  ],
  glare: [],
};
