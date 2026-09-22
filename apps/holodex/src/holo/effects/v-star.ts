import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

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
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.7 },
    },
  ],
};
