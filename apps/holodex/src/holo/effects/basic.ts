import type { Effect } from '../shader/types';

/** No foil. A soft pointer-tracking sheen so the card is not inert. */
export const basic: Effect = {
  id: 'basic',
  shine: [],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [1, 1, 1] },
              { at: 0.6, color: [0.15, 0.15, 0.18] },
              { at: 1, color: [0, 0, 0] },
            ],
          },
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 0.9 }, contrast: { base: 1.3 } },
      mixBlend: 'soft-light',
      opacity: { base: 0.15, fromCenter: 0.35 },
    },
  ],
};
