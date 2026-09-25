import type { Effect } from '../shader/types';
import { COVER, fixedFilter, grey, hsl, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';
import { SUNPILLAR } from './palette';

/**
 * v-star.css's .card__glare filter for a card with no mask: its
 * `:not(.masked)` rule's brightness(.55) contrast(2), more specific than the
 * brightness(.7) the plain rule sets.
 */
const GLARE_FILTER = { brightness: 0.55, contrast: 2 };

/**
 * A VSTAR. The shine is derived by eye from pokemon-cards-css; the glare is
 * ported from v-star.css, hard-lit, beneath the shine (legacy-glare.ts), and
 * only as strong as the pointer is far from the middle.
 */
export const vStar: Effect = {
  id: 'v-star',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: -20, space: 0.035, stops: SUNPILLAR },
          blend: 'normal',
          size: [4, 4],
          offset: { x: { base: 0, fromLeft: 1.1 }, y: { base: 0, fromTop: 1.1 } },
        },
        { source: { kind: 'glitter', scale: 7 }, blend: 'hard-light' },
      ],
      filter: {
        brightness: { base: 0.5, fromCenter: 0.35 },
        contrast: { base: 2.1 },
        saturate: { base: 1.2 },
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
            [stop(hsl(195, 90, 90), 5), stop(hsl(300, 3, 60), 60), stop(grey(0.15), 150)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--card-opacity) * (var(--pointer-from-center) * .75))
      opacity: { base: 0, fromCenter: 0.75 },
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
