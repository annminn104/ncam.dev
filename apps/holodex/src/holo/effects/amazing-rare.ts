import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const amazingRare: Effect = {
  id: 'amazing-rare',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 0, space: 0.03, stops: SUNPILLAR },
          blend: 'normal',
          size: [1, 6],
          offset: { x: { base: 0 }, y: { base: 0, fromTop: 1 } },
        },
        { source: { kind: 'grain', scale: 2 }, blend: 'saturation' },
      ],
      filter: {
        brightness: { base: 0.7, fromCenter: 0.3 },
        contrast: { base: 1.6 },
        saturate: { base: 1.8 },
      },
      mixBlend: 'lighten',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'overlay',
      opacity: { base: 0.2, fromCenter: 0.6 },
    },
  ],
};
