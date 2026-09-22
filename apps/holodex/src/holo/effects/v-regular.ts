import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const vRegular: Effect = {
  id: 'v-regular',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 133, space: 0.06, stops: SUNPILLAR },
          blend: 'normal',
          size: [2, 2],
          offset: { x: { base: 0, fromLeft: 0.8 }, y: { base: 0, fromTop: 0.8 } },
        },
      ],
      filter: {
        brightness: { base: 0.5, fromCenter: 0.3 },
        contrast: { base: 1.8 },
        saturate: { base: 1.1 },
      },
      mixBlend: 'soft-light',
      opacity: { base: 0.5, fromCenter: 0.35 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'hard-light',
      opacity: { base: 0.18, fromCenter: 0.6 },
    },
  ],
};
