import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const vFullArt: Effect = {
  id: 'v-full-art',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 133, space: 0.05, stops: SUNPILLAR },
          blend: 'normal',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
        { source: { kind: 'glitter', scale: 6 }, blend: 'overlay' },
      ],
      filter: {
        brightness: { base: 0.55, fromCenter: 0.3 },
        contrast: { base: 2 },
        saturate: { base: 1.2 },
      },
      mixBlend: 'exclusion',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      filter: { brightness: { base: 1 }, contrast: { base: 1.4 } },
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.7 },
    },
  ],
};
