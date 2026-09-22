import type { Effect } from '../shader/types';

export const swshPikachu: Effect = {
  id: 'swsh-pikachu',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 5 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 120,
            space: 0.04,
            stops: [
              [1, 0.85, 0.1],
              [1, 0.62, 0.05],
              [1, 0.93, 0.55],
            ],
          },
          blend: 'multiply',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 0.8 }, y: { base: 0, fromTop: 0.8 } },
        },
      ],
      filter: {
        brightness: { base: 0.55, fromCenter: 0.3 },
        contrast: { base: 1.8 },
        saturate: { base: 1.6 },
      },
      mixBlend: 'exclusion',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [1, 0.98, 0.85] },
              { at: 1, color: [0.1, 0.08, 0.02] },
            ],
          },
          blend: 'normal',
        },
      ],
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.7 },
    },
  ],
};
