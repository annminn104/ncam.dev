import type { Effect } from '../shader/types';
import { COVER, radial } from './css';
import { BASE_GLARE, glareNeutral } from './legacy-glare';
import { trainerGalleryHolo } from './trainer-gallery-holo';

/**
 * The reference gives gallery V cards the gallery holo look, a touch stronger
 * (the shine, derived by eye). Its glare is ported from
 * trainer-gallery-v-regular.css, which only sets its opacity, .4, over
 * base.css's radial; it lies beneath the shine (legacy-glare.ts), and replaces
 * trainer-gallery-holo's rather than inheriting it.
 */
export const trainerGalleryVRegular: Effect = {
  ...trainerGalleryHolo,
  id: 'trainer-gallery-v-regular',
  shine: trainerGalleryHolo.shine.map((el) => ({
    ...el,
    opacity: { base: 0.38, fromCenter: 0.4 },
  })),
  beneath: [
    {
      layers: [{ ...radial(BASE_GLARE, COVER, glareNeutral('overlay')), blend: 'normal' }],
      opacity: { base: 0.4 },
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
