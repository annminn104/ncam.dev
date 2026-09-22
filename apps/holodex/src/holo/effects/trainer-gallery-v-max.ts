import type { Effect } from '../shader/types';
import { trainerGalleryHolo } from './trainer-gallery-holo';

export const trainerGalleryVMax: Effect = {
  ...trainerGalleryHolo,
  id: 'trainer-gallery-v-max',
  shine: trainerGalleryHolo.shine.map((el) => ({
    ...el,
    opacity: { base: 0.45, fromCenter: 0.45 },
  })),
};
