import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const trainerGalleryHolo: Effect = {
  id: 'trainer-gallery-holo',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 120, space: 0.06, stops: SUNPILLAR },
          blend: 'normal',
          size: [2, 2],
          offset: { x: { base: 0, fromLeft: 0.7 }, y: { base: 0, fromTop: 0.7 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.25 },
        contrast: { base: 1.5 },
        saturate: { base: 1 },
      },
      mixBlend: 'hard-light',
      opacity: { base: 0.3, fromCenter: 0.35 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      mixBlend: 'soft-light',
      opacity: { base: 0.2, fromCenter: 0.5 },
    },
  ],
};
