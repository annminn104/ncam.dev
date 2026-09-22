import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const radiantHolo: Effect = {
  id: 'radiant-holo',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 45, space: 0.02, stops: SUNPILLAR },
          blend: 'normal',
          size: [5, 5],
          offset: { x: { base: 0, fromLeft: 1.2 }, y: { base: 0, fromTop: 1.2 } },
        },
        {
          source: { kind: 'repeating-linear', angleDeg: -45, space: 0.03, stops: SUNPILLAR },
          blend: 'hard-light',
          size: [5, 5],
          offset: { x: { base: 0, fromLeft: -1 }, y: { base: 0, fromTop: 1 } },
        },
      ],
      filter: {
        brightness: { base: 0.5, fromCenter: 0.35 },
        contrast: { base: 2.4 },
        saturate: { base: 1.5 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.5, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      filter: { brightness: { base: 1 }, contrast: { base: 1.6 } },
      mixBlend: 'overlay',
      opacity: { base: 0.22, fromCenter: 0.6 },
    },
  ],
};
