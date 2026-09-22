import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const trainerFullArt: Effect = {
  id: 'trainer-full-art',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 133, space: 0.07, stops: SUNPILLAR },
          blend: 'normal',
          size: [2.5, 2.5],
          offset: { x: { base: 0, fromLeft: 0.7 }, y: { base: 0, fromTop: 0.7 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.25 },
        contrast: { base: 1.5 },
        saturate: { base: 0.9 },
      },
      mixBlend: 'screen',
      opacity: { base: 0.3, fromCenter: 0.35 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'multiply',
      opacity: { base: 0.15, fromCenter: 0.5 },
    },
  ],
};
