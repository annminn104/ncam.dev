import type { Effect } from '../shader/types';

/** Rare Holo: spectral bands over scanlines, clipped to the art window. */
export const regularHolo: Effect = {
  id: 'regular-holo',
  shine: [
    {
      layers: [
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 110,
            space: 0.05,
            stops: [
              [0.79, 0.16, 0.95],
              [0.05, 0.74, 0.91],
              [0.13, 0.91, 0.52],
              [0.93, 0.87, 0.06],
              [0.97, 0.05, 0.21],
            ],
          },
          blend: 'normal',
          size: [2.2, 2.2],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
        {
          source: { kind: 'scanlines', spacing: 0.006, light: 0.4, dark: 0.0 },
          blend: 'overlay',
        },
      ],
      filter: {
        brightness: { base: 0.55, fromCenter: 0.35 },
        contrast: { base: 2.2 },
        saturate: { base: 1.4 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.45, fromCenter: 0.45 },
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
              { at: 1, color: [0.08, 0.08, 0.1] },
            ],
          },
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 0.85 }, contrast: { base: 1.7 } },
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.6 },
    },
  ],
};
