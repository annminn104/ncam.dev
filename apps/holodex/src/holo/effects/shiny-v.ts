import type { Effect } from '../shader/types';
import { GLARE_STOPS } from './palette';

export const shinyV: Effect = {
  id: 'shiny-v',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 6 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 140,
            space: 0.05,
            stops: [
              [0.6, 0.78, 0.95],
              [0.22, 0.3, 0.5],
              [0.85, 0.9, 1],
            ],
          },
          blend: 'darken',
          size: [3.5, 3.5],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
      ],
      filter: {
        brightness: { base: 0.62, fromCenter: 0.28 },
        contrast: { base: 2 },
        saturate: { base: 0.9 },
      },
      mixBlend: 'exclusion',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'overlay',
      opacity: { base: 0.2, fromCenter: 0.65 },
    },
  ],
};
