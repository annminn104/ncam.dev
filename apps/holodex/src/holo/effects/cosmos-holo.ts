import type { Effect } from '../shader/types';

/** Cosmos foil: galaxy speckle under spectral bands, three parallaxed layers. */
export const cosmosHolo: Effect = {
  id: 'cosmos-holo',
  shine: [
    {
      layers: [
        { source: { kind: 'grain', scale: 1 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 82,
            space: 0.04,
            stops: [
              [0.86, 0.79, 0.35],
              [0.55, 0.82, 0.33],
              [0.33, 0.78, 0.86],
              [0.62, 0.38, 0.87],
            ],
          },
          blend: 'multiply',
          size: [4, 9],
          offset: { x: { base: 0.1, fromLeft: 0.8 }, y: { base: 0.1, fromTop: 0.8 } },
        },
      ],
      filter: { brightness: { base: 1 }, contrast: { base: 1 }, saturate: { base: 0.8 } },
      mixBlend: 'color-dodge',
      opacity: { base: 0.5, fromCenter: 0.3 },
    },
    {
      layers: [
        { source: { kind: 'glitter', scale: 3 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 82,
            space: 0.04,
            stops: [
              [0.86, 0.79, 0.35],
              [0.33, 0.78, 0.86],
            ],
          },
          blend: 'lighten',
          size: [4, 9],
          offset: { x: { base: 0.15, fromLeft: 0.7 }, y: { base: 0.15, fromTop: 0.7 } },
        },
      ],
      filter: { brightness: { base: 1.25 }, contrast: { base: 1.75 }, saturate: { base: 0.8 } },
      mixBlend: 'overlay',
      opacity: { base: 0.6, fromCenter: 0.3 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0.05, color: [0.85, 0.94, 1] },
              { at: 1, color: [0.17, 0.16, 0.22] },
            ],
          },
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 0.75 }, contrast: { base: 2 }, saturate: { base: 2 } },
      mixBlend: 'overlay',
      opacity: { base: 0.25, fromCenter: 0.6 },
    },
  ],
};
