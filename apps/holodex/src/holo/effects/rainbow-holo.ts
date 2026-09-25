import type { Effect } from '../shader/types';
import { COVER, fixedFilter, grey, hsl, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';
import { RAINBOW_MUTED } from './palette';

/** rainbow-holo.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 0.9, contrast: 1.75 };

/**
 * A rainbow rare. The shine is derived by eye from pokemon-cards-css; the
 * glare is ported from rainbow-holo.css, hard-lit, beneath the shine
 * (legacy-glare.ts), and only as strong as the pointer is far from the
 * middle. Its first stop has no position, which CSS reads as 0%.
 */
export const rainbowHolo: Effect = {
  id: 'rainbow-holo',
  shine: [
    {
      layers: [
        {
          source: { kind: 'linear', angleDeg: -45, stops: RAINBOW_MUTED },
          blend: 'normal',
          size: [2, 2],
          offset: { x: { base: 0.25, fromLeft: 0.5 }, y: { base: 0.25, fromTop: 0.5 } },
        },
        { source: { kind: 'glitter', scale: 4 }, blend: 'soft-light' },
        {
          source: { kind: 'linear', angleDeg: -30, stops: RAINBOW_MUTED },
          blend: 'luminosity',
          size: [4, 4],
          offset: { x: { base: 0.25, fromLeft: 0.5 }, y: { base: 0.25, fromTop: 0.5 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.25 },
        contrast: { base: 2.2 },
        saturate: { base: 0.75 },
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
            [stop(grey(0.8), 0), stop(hsl(187, 10, 85), 30, 0.25), stop(hsl(197, 6, 25), 120)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--pointer-from-center) * 0.9)
      opacity: { base: 0, fromCenter: 0.9 },
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
