import type { Effect } from '../shader/types';
import { SUNPILLAR } from './palette';

export const secretRare: Effect = {
  id: 'secret-rare',
  shine: [
    {
      layers: [
        {
          source: { kind: 'glitter', scale: 4 },
          blend: 'normal',
          offset: { x: { base: 0.45 }, y: { base: 0.45 } },
        },
        {
          source: { kind: 'glitter', scale: 4 },
          blend: 'hard-light',
          offset: { x: { base: 0.55 }, y: { base: 0.55 } },
        },
        { source: { kind: 'conic', stops: SUNPILLAR }, blend: 'overlay' },
      ],
      filter: {
        brightness: { base: 0.4, fromCenter: 0.2 },
        contrast: { base: 1 },
        saturate: { base: 2.7 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.55, fromCenter: 0.35 },
    },
    {
      layers: [
        {
          source: {
            kind: 'linear',
            angleDeg: 45,
            stops: [
              [0.98, 0.76, 0.03],
              [1, 0.9, 0.42],
            ],
          },
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 1.25 }, contrast: { base: 1.25 }, saturate: { base: 0.35 } },
      mixBlend: 'lighten',
      opacity: { base: 0.35, fromCenter: 0.25 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [0.82, 0.8, 0.76] },
              { at: 1, color: [0.13, 0.11, 0.09] },
            ],
          },
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 1.3 }, contrast: { base: 1.5 } },
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.6 },
    },
  ],
};
