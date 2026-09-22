import type { Effect } from '../shader/types';
import { trainerGalleryHolo } from './trainer-gallery-holo';

/** The reference gives gallery V cards the gallery holo look, a touch stronger. */
export const trainerGalleryVRegular: Effect = {
  ...trainerGalleryHolo,
  id: 'trainer-gallery-v-regular',
  shine: trainerGalleryHolo.shine.map((el) => ({
    ...el,
    opacity: { base: 0.38, fromCenter: 0.4 },
  })),
};
