import type { Effect } from '../shader/types';
import { COVER, radial } from './css';
import { BASE_GLARE, glareNeutral } from './legacy-glare';
import { vFullArt } from './v-full-art';

/**
 * A trainer gallery V. Its shine is v-full-art's: pokemon-cards-css styles a
 * gallery V (`[data-rarity="rare holo v"][data-trainer-gallery="true"]`) by
 * v-full-art.css's own rules, unmasked path and all, over the whole card. Its
 * glare is ported from trainer-gallery-v-regular.css, which only sets its
 * opacity, .4, over base.css's radial; it lies beneath the shine
 * (legacy-glare.ts).
 */
export const trainerGalleryVRegular: Effect = {
  id: 'trainer-gallery-v-regular',
  shine: vFullArt.shine,
  beneath: [
    {
      layers: [{ ...radial(BASE_GLARE, COVER, glareNeutral('overlay')), blend: 'normal' }],
      opacity: { base: 0.4 },
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
