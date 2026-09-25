import type { Effect } from '../shader/types';
import { COVER, fixedFilter, hsl, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';
import { SUNPILLAR } from './palette';

/**
 * trainer-gallery-secret-rare.css's .card__glare filter for a card with no
 * mask: its `:not(.masked)` rule's brightness(.5) contrast(1), more specific
 * than the brightness(1) the gallery rule sets.
 */
const GLARE_FILTER = { brightness: 0.5, contrast: 1 };

/**
 * A trainer gallery secret rare. The shine is derived by eye from
 * pokemon-cards-css; the glare is ported from trainer-gallery-secret-rare.css,
 * hard-lit, beneath the shine (legacy-glare.ts).
 */
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
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(hsl(40, 100, 95), 10, 0.2), stop(hsl(40, 20, 5), 180)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
