import type { Effect } from '../shader/types';
import { COVER, fixedFilter, grey, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';

/** swsh-pikachu.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 0.9, contrast: 2 };

/**
 * Crown Zenith's gold Pikachu. The shine is derived by eye from
 * pokemon-cards-css; the glare is ported from swsh-pikachu.css, hard-lit,
 * beneath the shine (legacy-glare.ts), and only as strong as the pointer is
 * far from the middle. Its first stop has no position, which CSS reads as 0%.
 */
export const swshPikachu: Effect = {
  id: 'swsh-pikachu',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 5 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 120,
            space: 0.04,
            stops: [
              [1, 0.85, 0.1],
              [1, 0.62, 0.05],
              [1, 0.93, 0.55],
            ],
          },
          blend: 'multiply',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 0.8 }, y: { base: 0, fromTop: 0.8 } },
        },
      ],
      filter: {
        brightness: { base: 0.55, fromCenter: 0.3 },
        contrast: { base: 1.8 },
        saturate: { base: 1.6 },
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
            [stop(grey(0.8), 0), stop(grey(0.749), 30, 0.25), stop(grey(0.216), 130)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--pointer-from-center) * .9)
      opacity: { base: 0, fromCenter: 0.9 },
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
