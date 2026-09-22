import type { Card, Variants } from '../lib/tcgdex';

/**
 * One effect per look in simeydotme/pokemon-cards-css. Four of these are
 * reachable only through the overrides below and never appear in the rarity
 * table — see OVERRIDE_ONLY_EFFECTS.
 */
export type EffectId =
  | 'basic'
  | 'reverse-holo'
  | 'regular-holo'
  | 'cosmos-holo'
  | 'amazing-rare'
  | 'radiant-holo'
  | 'rainbow-holo'
  | 'rainbow-alt'
  | 'secret-rare'
  | 'shiny-rare'
  | 'shiny-v'
  | 'shiny-vmax'
  | 'v-regular'
  | 'v-full-art'
  | 'v-max'
  | 'v-star'
  | 'trainer-full-art'
  | 'trainer-gallery-holo'
  | 'trainer-gallery-v-regular'
  | 'trainer-gallery-v-max'
  | 'trainer-gallery-secret-rare'
  | 'swsh-pikachu';

/** Which part of the card the foil is confined to. */
export type ClipShape = 'regular' | 'stage' | 'trainer' | 'borders' | 'full';

export interface HoloSelection {
  effect: EffectId;
  shape: ClipShape;
  /** reverse-holo inverts its clip: foil everywhere EXCEPT the region. */
  invert: boolean;
}

/**
 * Effects with no rarity of their own. `reverse-holo` comes from a printing
 * variant; the gallery effects come from the card number. A test asserts this
 * list is exactly the set of effects missing from EFFECT_BY_RARITY.
 */
export const OVERRIDE_ONLY_EFFECTS: EffectId[] = [
  'reverse-holo',
  'trainer-gallery-v-regular',
  'trainer-gallery-v-max',
  'trainer-gallery-secret-rare',
];

/** All 42 TCGdex rarities. Asserted complete in both directions. */
export const EFFECT_BY_RARITY: Record<string, EffectId> = {
  Common: 'basic',
  Uncommon: 'basic',
  None: 'basic',
  'One Diamond': 'basic',
  'Two Diamond': 'basic',
  'Three Diamond': 'basic',
  'Four Diamond': 'basic',
  Rare: 'basic',
  Promo: 'basic',
  'One Star': 'basic',

  'Holo Rare': 'regular-holo',
  'Rare Holo': 'regular-holo',
  'Rare Holo LV.X': 'regular-holo',
  'Rare PRIME': 'regular-holo',
  LEGEND: 'regular-holo',

  'Classic Collection': 'cosmos-holo',
  'Black White Rare': 'cosmos-holo',

  'Amazing Rare': 'amazing-rare',
  'Radiant Rare': 'radiant-holo',

  'Hyper rare': 'rainbow-holo',
  'Mega Hyper Rare': 'rainbow-holo',
  Crown: 'rainbow-holo',

  'Futuristic Rare': 'rainbow-alt',
  'Three Star': 'rainbow-alt',

  'Secret Rare': 'secret-rare',
  'ACE SPEC Rare': 'secret-rare',
  'Special illustration rare': 'secret-rare',

  'Shiny rare': 'shiny-rare',
  'One Shiny': 'shiny-rare',
  'Two Shiny': 'shiny-rare',

  'Shiny rare V': 'shiny-v',
  'Shiny Ultra Rare': 'shiny-v',
  'Shiny rare VMAX': 'shiny-vmax',

  'Holo Rare V': 'v-regular',
  'Ultra Rare': 'v-full-art',
  // Double rare is the ordinary SV-era ex card: standard layout, normal art
  // window. It is NOT a full art — that's Ultra Rare (full-art ex) and
  // Special illustration rare (secret-rare tier). v-regular gets the
  // standard-layout holo treatment and, unlike v-full-art, is not in
  // FULL_ART, so clipShape() falls through to regular/stage/trainer by
  // category instead of covering the whole card.
  'Double rare': 'v-regular',
  'Two Star': 'v-full-art',
  'Holo Rare VMAX': 'v-max',
  'Holo Rare VSTAR': 'v-star',

  'Full Art Trainer': 'trainer-full-art',
  'Illustration rare': 'trainer-gallery-holo',
  'Pikachu Rare': 'swsh-pikachu',
};

/** Effects whose foil covers the entire card rather than an art window. */
const FULL_ART: ReadonlySet<EffectId> = new Set<EffectId>([
  'v-full-art',
  'secret-rare',
  'rainbow-holo',
  'rainbow-alt',
  'shiny-rare',
  'shiny-v',
  'shiny-vmax',
  'v-max',
  'v-star',
  'swsh-pikachu',
]);

/** Effects the reference clips to the card's rounded border, not its art. */
const BORDERS: ReadonlySet<EffectId> = new Set<EffectId>([
  'radiant-holo',
  'trainer-gallery-holo',
  'trainer-gallery-v-regular',
  'trainer-gallery-v-max',
  'trainer-gallery-secret-rare',
]);

/** Effects a reverse printing is allowed to replace. */
const REVERSIBLE: ReadonlySet<EffectId> = new Set<EffectId>(['basic', 'regular-holo']);

/** The reference detects gallery cards from the card number, not a rarity. */
function isTrainerGallery(localId: string | undefined): boolean {
  return /^[tg]g/i.test(localId ?? '');
}

function galleryEffect(base: EffectId): EffectId {
  if (base === 'v-regular') return 'trainer-gallery-v-regular';
  if (base === 'v-max') return 'trainer-gallery-v-max';
  if (base === 'secret-rare') return 'trainer-gallery-secret-rare';
  // Every 'Full Art Trainer' card TCGdex has is TG-numbered, so without this
  // arm the gallery override swallowed all six of them into
  // 'trainer-gallery-holo' and 'trainer-full-art' was unreachable — as was
  // the `rarity === 'Full Art Trainer'` branch in clipShape() below. A full
  // art trainer is a full art first and a gallery card second: it keeps its
  // own effect and the `full` clip rather than the gallery `borders` clip.
  if (base === 'trainer-full-art') return 'trainer-full-art';
  return 'trainer-gallery-holo';
}

function clipShape(effect: EffectId, card: Card): ClipShape {
  // Order matters: radiant and the gallery effects clip to the border, and
  // would otherwise be claimed by the full-art or trainer rules below.
  if (BORDERS.has(effect)) return 'borders';
  if (card.rarity === 'Full Art Trainer') return 'full';
  if (FULL_ART.has(effect)) return 'full';
  if (card.category === 'Trainer') return 'trainer';
  if (card.stage === 'Stage1' || card.stage === 'Stage2') return 'stage';
  return 'regular';
}

/** Which foil a card gets, where it is confined, and whether that is inverted. */
export function selectHolo(card: Card): HoloSelection {
  let base: EffectId = (card.rarity && EFFECT_BY_RARITY[card.rarity]) || 'basic';

  // TCGdex files every promo — plain reprints and holo V/ex/GX chase cards
  // alike — under the single rarity 'Promo', which EFFECT_BY_RARITY maps to
  // 'basic'. The reference (CardProxy.svelte) recovers the real foil by
  // rewriting the rarity from the card's subtypes before selecting one; we
  // don't have subtypes, but `suffix` (V, ex, GX, EX, TAG TEAM-GX, ...) is
  // the same signal when TCGdex populates it, so a promo carrying one gets
  // the standard V/ex holo treatment instead of rendering flat. A promo with
  // no suffix really is unfoiled and stays on 'basic'.
  //
  // This deliberately does not special-case VMAX/VSTAR promos: TCGdex's
  // `suffix` is inconsistent for them (swsh3-2 Butterfree VMAX has no
  // suffix, while swsh12-008 Serperior VSTAR has suffix "V"). Parsing the
  // card name instead would be fragile and language-dependent, so we leave
  // that gap rather than guess.
  if (base === 'basic' && card.rarity === 'Promo' && card.suffix) {
    base = 'v-regular';
  }

  let effect = base;
  let invert = false;

  if (isTrainerGallery(card.localId)) {
    effect = galleryEffect(base);
  } else if (REVERSIBLE.has(base) && (card.variants as Variants | undefined)?.reverse) {
    effect = 'reverse-holo';
    invert = true;
  }

  return { effect, shape: clipShape(effect, card), invert };
}
