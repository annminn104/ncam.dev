import type { Effect } from '../shader/types';
import { BLACK, COVER, fixedFilter, hsl, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';
import { trainerGalleryHolo } from './trainer-gallery-holo';

/** trainer-gallery-v-max.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1, contrast: 1 };

/**
 * A trainer gallery VMAX: the gallery holo's shine, stronger (derived by eye).
 * Its glare is ported from trainer-gallery-v-max.css, overlaid (from
 * base.css), beneath the shine (legacy-glare.ts), and only as strong as the
 * pointer is far from the middle; it replaces trainer-gallery-holo's rather
 * than inheriting it. Its middle stop has no position, which CSS puts midway
 * between its neighbours, at 60%.
 */
export const trainerGalleryVMax: Effect = {
  ...trainerGalleryHolo,
  id: 'trainer-gallery-v-max',
  shine: trainerGalleryHolo.shine.map((el) => ({
    ...el,
    opacity: { base: 0.45, fromCenter: 0.45 },
  })),
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(hsl(50, 30, 90), 0), stop(hsl(162, 5, 40), 60), stop(BLACK, 120)],
            COVER,
            glareNeutral('overlay', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--card-opacity) * var(--pointer-from-center) * 0.85)
      opacity: { base: 0, fromCenter: 0.85 },
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
