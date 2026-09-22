import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

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
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'hard-light',
      opacity: { base: 0.15, fromCenter: 0.7 },
    },
  ],
};
