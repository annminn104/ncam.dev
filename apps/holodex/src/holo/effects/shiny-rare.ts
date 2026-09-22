import type { Effect } from '../shader/types';
import { GLARE_STOPS } from './palette';

export const shinyRare: Effect = {
  id: 'shiny-rare',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 8 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 100,
            space: 0.04,
            stops: [
              [0.75, 0.85, 0.95],
              [0.35, 0.45, 0.6],
              [0.9, 0.92, 0.98],
            ],
          },
          blend: 'difference',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 0.9 }, y: { base: 0, fromTop: 0.9 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.3 },
        contrast: { base: 1.9 },
        saturate: { base: 0.8 },
      },
      mixBlend: 'exclusion',
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
