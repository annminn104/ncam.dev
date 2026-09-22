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

/**
 * Every effect `selectHolo` can return. The registry test asserts this covers
 * exactly that set — a missing entry is a failing test, not a blank card.
 */
export const EFFECTS = {
  basic,
  'reverse-holo': reverseHolo,
  'regular-holo': regularHolo,
  'cosmos-holo': cosmosHolo,
  'rainbow-holo': rainbowHolo,
  'rainbow-alt': rainbowAlt,
  'secret-rare': secretRare,
  'swsh-pikachu': swshPikachu,
  'amazing-rare': amazingRare,
  'radiant-holo': radiantHolo,
  'v-regular': vRegular,
  'v-full-art': vFullArt,
  'v-max': vMax,
  'v-star': vStar,
  'trainer-full-art': trainerFullArt,
  // TODO(task-9): once the remaining 18 effects land and this object honestly
  // satisfies Record<EffectId, Effect> on its own, delete the cast below.
} as unknown as Record<EffectId, Effect>;
