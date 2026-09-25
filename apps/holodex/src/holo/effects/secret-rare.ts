import type { Effect } from '../shader/types';
import { COVER, fixedFilter, hsl, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';
import { SUNPILLAR } from './palette';

/** secret-rare.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1.3, contrast: 1.5 };

/**
 * A secret rare. The shine is derived by eye from pokemon-cards-css; the glare
 * is ported from secret-rare.css, hard-lit, beneath the shine
 * (legacy-glare.ts).
 */
export const secretRare: Effect = {
  id: 'secret-rare',
  shine: [
    {
      layers: [
        {
          source: { kind: 'glitter', scale: 4 },
          blend: 'normal',
          offset: { x: { base: 0.45 }, y: { base: 0.45 } },
        },
        {
          source: { kind: 'glitter', scale: 4 },
          blend: 'hard-light',
          offset: { x: { base: 0.55 }, y: { base: 0.55 } },
        },
        { source: { kind: 'conic', stops: SUNPILLAR }, blend: 'overlay' },
      ],
      filter: {
        brightness: { base: 0.4, fromCenter: 0.2 },
        contrast: { base: 1 },
        saturate: { base: 2.7 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.55, fromCenter: 0.35 },
    },
    {
      layers: [
        {
          source: {
            kind: 'linear',
            angleDeg: 45,
            stops: [
              [0.98, 0.76, 0.03],
              [1, 0.9, 0.42],
            ],
          },
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 1.25 }, contrast: { base: 1.25 }, saturate: { base: 0.35 } },
      mixBlend: 'lighten',
      opacity: { base: 0.35, fromCenter: 0.25 },
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(hsl(45, 8, 80), 0, 0.3), stop(hsl(22, 15, 12), 180)],
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
