import type { EffectId } from '../select';
import type { Effect } from '../shader/types';
import { basic } from './basic';
import { reverseHolo } from './reverse-holo';
import { regularHolo } from './regular-holo';
import { cosmosHolo } from './cosmos-holo';
import { rainbowHolo } from './rainbow-holo';
import { rainbowAlt } from './rainbow-alt';
import { secretRare } from './secret-rare';
import { swshPikachu } from './swsh-pikachu';
import { amazingRare } from './amazing-rare';
import { radiantHolo } from './radiant-holo';
import { vRegular } from './v-regular';
import { vFullArt } from './v-full-art';
import { vMax } from './v-max';
import { vStar } from './v-star';
import { trainerFullArt } from './trainer-full-art';
import { shinyRare } from './shiny-rare';
import { shinyV } from './shiny-v';
import { shinyVmax } from './shiny-vmax';
import { trainerGalleryHolo } from './trainer-gallery-holo';
import { trainerGalleryVRegular } from './trainer-gallery-v-regular';
import { trainerGalleryVMax } from './trainer-gallery-v-max';
import { trainerGallerySecretRare } from './trainer-gallery-secret-rare';

/**
 * Every effect `selectHolo` can return. The registry test asserts this covers
 * exactly that set — a missing entry is a failing test, not a blank card.
 */
export const EFFECTS: Record<EffectId, Effect> = {
  basic,
  'reverse-holo': reverseHolo,
  'regular-holo': regularHolo,
  'cosmos-holo': cosmosHolo,
  'amazing-rare': amazingRare,
  'radiant-holo': radiantHolo,
  'rainbow-holo': rainbowHolo,
  'rainbow-alt': rainbowAlt,
  'secret-rare': secretRare,
  'shiny-rare': shinyRare,
  'shiny-v': shinyV,
  'shiny-vmax': shinyVmax,
  'v-regular': vRegular,
  'v-full-art': vFullArt,
  'v-max': vMax,
  'v-star': vStar,
  'trainer-full-art': trainerFullArt,
  'trainer-gallery-holo': trainerGalleryHolo,
  'trainer-gallery-v-regular': trainerGalleryVRegular,
  'trainer-gallery-v-max': trainerGalleryVMax,
  'trainer-gallery-secret-rare': trainerGallerySecretRare,
  'swsh-pikachu': swshPikachu,
};
