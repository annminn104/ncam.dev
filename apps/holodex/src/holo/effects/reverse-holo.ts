import type { Effect } from '../shader/types';

/** Reverse holo: glitter over the card body, art window left clean. */
export const reverseHolo: Effect = {
  id: 'reverse-holo',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 6 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 110,
            space: 0.05,
            stops: [
              [0.78, 0.18, 0.21],
              [0.93, 0.87, 0.06],
              [0.13, 0.91, 0.52],
              [0.05, 0.74, 0.91],
              [0.79, 0.16, 0.95],
            ],
          },
          blend: 'soft-light',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 0.6 }, y: { base: 0, fromTop: 0.6 } },
        },
      ],
      filter: {
        brightness: { base: 0.55, fromCenter: 0.3 },
        contrast: { base: 1.6 },
        saturate: { base: 1.2 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.4, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [1, 1, 1] },
              { at: 1, color: [0.05, 0.05, 0.08] },
            ],
          },
          blend: 'normal',
        },
      ],
      mixBlend: 'hard-light',
      opacity: { base: 0.18, fromCenter: 0.5 },
    },
  ],
};
