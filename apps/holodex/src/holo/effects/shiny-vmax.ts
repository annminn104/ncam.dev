import type { Effect } from '../shader/types';
import { GLARE_STOPS, SUNPILLAR } from './palette';

export const shinyVmax: Effect = {
  id: 'shiny-vmax',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 7 }, blend: 'normal' },
        {
          source: { kind: 'repeating-linear', angleDeg: 115, space: 0.045, stops: SUNPILLAR },
          blend: 'hue',
          size: [4, 4],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.3 },
        contrast: { base: 1.8 },
        saturate: { base: 1.4 },
      },
      mixBlend: 'lighten',
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
