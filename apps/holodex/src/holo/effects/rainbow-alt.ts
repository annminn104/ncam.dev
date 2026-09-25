import type { Effect } from '../shader/types';
import { BLACK, COVER, fixedFilter, hsl, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';
import { SUNPILLAR } from './palette';

/** rainbow-alt.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 0.9, contrast: 2 };

/**
 * An alternate-art rainbow rare. The shine is derived by eye from
 * pokemon-cards-css; the glare is ported from rainbow-alt.css, overlaid (from
 * base.css), beneath the shine (legacy-glare.ts).
 */
export const rainbowAlt: Effect = {
  id: 'rainbow-alt',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: -60, space: 0.035, stops: SUNPILLAR },
          blend: 'normal',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 0.9 }, y: { base: 0, fromTop: 0.9 } },
        },
        { source: { kind: 'glitter', scale: 5 }, blend: 'soft-light' },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.3 },
        contrast: { base: 2 },
        saturate: { base: 1.3 },
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
            [stop(hsl(50, 20, 90), 0, 0.75), stop(hsl(150, 20, 30), 45, 0.65), stop(BLACK, 100)],
            COVER,
            glareNeutral('overlay', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      opacity: { base: 0.75 },
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
