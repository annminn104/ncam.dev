import type { Effect } from '../shader/types';
import { SUNPILLAR } from './palette';

export const trainerGallerySecretRare: Effect = {
  id: 'trainer-gallery-secret-rare',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 5 }, blend: 'normal' },
        { source: { kind: 'conic', stops: SUNPILLAR }, blend: 'soft-light' },
        {
          source: {
            kind: 'linear',
            angleDeg: 45,
            stops: [
              [0.98, 0.76, 0.03],
              [1, 0.9, 0.42],
            ],
          },
          blend: 'hard-light',
        },
      ],
      filter: {
        brightness: { base: 0.5, fromCenter: 0.25 },
        contrast: { base: 1.6 },
        saturate: { base: 1.8 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.4, fromCenter: 0.35 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [0.9, 0.86, 0.75] },
              { at: 1, color: [0.12, 0.1, 0.06] },
            ],
          },
          blend: 'normal',
        },
      ],
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.6 },
    },
  ],
};
