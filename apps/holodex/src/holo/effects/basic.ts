import type { Effect } from '../shader/types';
import { COVER, radial } from './css';
import { BASE_GLARE, glareNeutral } from './legacy-glare';

/**
 * No foil: the card as printed, under base.css's glare, which pokemon-cards-css
 * paints on every card (basic.css adds nothing to it). It lies beneath where a
 * shine would be, as the reference's z-index stacks it; basic has no shine.
 */
export const basic: Effect = {
  id: 'basic',
  shine: [],
  beneath: [
    {
      layers: [{ ...radial(BASE_GLARE, COVER, glareNeutral('overlay')), blend: 'normal' }],
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
