import type { Effect } from '../shader/types';
import { GLARE_STOPS, RAINBOW_MUTED } from './palette';

export const rainbowHolo: Effect = {
  id: 'rainbow-holo',
  shine: [
    {
      layers: [
        {
          source: { kind: 'linear', angleDeg: -45, stops: RAINBOW_MUTED },
          blend: 'normal',
          size: [2, 2],
          offset: { x: { base: 0.25, fromLeft: 0.5 }, y: { base: 0.25, fromTop: 0.5 } },
        },
        { source: { kind: 'glitter', scale: 4 }, blend: 'soft-light' },
        {
          source: { kind: 'linear', angleDeg: -30, stops: RAINBOW_MUTED },
          blend: 'luminosity',
          size: [4, 4],
          offset: { x: { base: 0.25, fromLeft: 0.5 }, y: { base: 0.25, fromTop: 0.5 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.25 },
        contrast: { base: 2.2 },
        saturate: { base: 0.75 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.5, fromCenter: 0.4 },
    },
  ],
  glare: [
    {
      layers: [{ source: { kind: 'radial-pointer', stops: GLARE_STOPS }, blend: 'normal' }],
      filter: { brightness: { base: 0.9 }, contrast: { base: 1.75 } },
      mixBlend: 'hard-light',
      opacity: { base: 0.1, fromCenter: 0.9 },
    },
  ],
};
