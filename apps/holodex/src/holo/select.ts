import type { Card } from '../lib/tcgdex';

/**
 * One effect per look in simeydotme/pokemon-cards-css (the first 22) and in
 * its Scarlet & Violet sequel, simeydotme/pokemon-cards-151 (the last seven).
 * Seven of these are reachable only through the overrides below and never
 * appear in the rarity table — see OVERRIDE_ONLY_EFFECTS.
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
  | 'swsh-pikachu'
  | 'ex-regular'
  | 'ex-full-art'
  | 'illustration-rare'
  | 'ex-special-illustration-rare'
  | 'hyper-rare'
  | 'poke-ball-holo'
  | 'masterball-holo';

/** Which part of the card the foil is confined to. */
export type ClipShape = 'regular' | 'stage' | 'trainer' | 'borders' | 'full';

export interface HoloSelection {
  effect: EffectId;
  shape: ClipShape;
  /** reverse-holo inverts its clip: foil everywhere EXCEPT the region. */
  invert: boolean;
}

/**
 * Effects with no rarity of their own. The three reverse foils come from the
 * caller's explicit `reverse` option (SelectOptions), never from the card:
 * `reverse-holo` on every set but 151, whose reverse holos are Poké Ball and
 * Master Ball patterned (reverseEffect). The four gallery effects come from the
 * card number — `trainer-gallery-holo` too, now that `Illustration rare`, the
 * one rarity that used to select it, selects `illustration-rare`. A test
 * asserts this list is exactly the set of effects missing from
 * EFFECT_BY_RARITY.
 */
export const OVERRIDE_ONLY_EFFECTS: EffectId[] = [
  'reverse-holo',
  'poke-ball-holo',
  'masterball-holo',
  'trainer-gallery-holo',
  'trainer-gallery-v-regular',
  'trainer-gallery-v-max',
  'trainer-gallery-secret-rare',
];

/**
 * All 42 TCGdex rarities. Asserted complete in both directions. Two of them
 * change effect with the card's era: for those, this is the effect every card
 * older than Scarlet & Violet takes, and MODERN_EFFECT_BY_RARITY holds the one
 * a Scarlet & Violet or Mega card takes instead.
 *
 * The Scarlet & Violet rows follow the CSS selectors of
 * simeydotme/pokemon-cards-151, the reference's SV sequel; pokemon-cards-css,
 * which the rest derive from, has no SV rarities at all. Neither has Pokémon
 * Pocket's: each Pocket rarity takes the look of the tier it stands for.
 */
export const EFFECT_BY_RARITY: Record<string, EffectId> = {
  Common: 'basic',
  Uncommon: 'basic',
  None: 'basic',
  'One Diamond': 'basic',
  'Two Diamond': 'basic',
  // The non-holo rare, on an older card. A Scarlet & Violet or Mega Rare is
  // printed holo: MODERN_EFFECT_BY_RARITY.
  Rare: 'basic',
  Promo: 'basic',

  'Holo Rare': 'regular-holo',
  'Rare Holo': 'regular-holo',
  'Rare Holo LV.X': 'regular-holo',
  'Rare PRIME': 'regular-holo',
  LEGEND: 'regular-holo',
  'Three Diamond': 'regular-holo',

  'Classic Collection': 'cosmos-holo',
  'Black White Rare': 'cosmos-holo',

  'Amazing Rare': 'amazing-rare',
  'Radiant Rare': 'radiant-holo',

  // The Scarlet & Violet prism foil, not gold — and, now that the gold tier
  // has hyper-rare, the only rarity that keeps rainbow-holo reachable.
  'ACE SPEC Rare': 'rainbow-holo',

  // Pocket's top art tier would fit ex-special-illustration-rare, but it stays
  // here on purpose: without it rainbow-alt keeps only Futuristic Rare, which
  // has two cards in all of TCGdex.
  'Futuristic Rare': 'rainbow-alt',
  'Three Star': 'rainbow-alt',

  'Secret Rare': 'secret-rare',

  'Shiny rare': 'shiny-rare',
  'One Shiny': 'shiny-rare',

  'Shiny rare V': 'shiny-v',
  'Shiny Ultra Rare': 'shiny-v',
  'Two Shiny': 'shiny-v',
  'Shiny rare VMAX': 'shiny-vmax',

  'Holo Rare V': 'v-regular',
  // The full-art V or GX, on an older card. On a Scarlet & Violet or Mega card
  // it is the full-art ex: MODERN_EFFECT_BY_RARITY.
  'Ultra Rare': 'v-full-art',
  'Holo Rare VMAX': 'v-max',
  'Holo Rare VSTAR': 'v-star',

  'Full Art Trainer': 'trainer-full-art',
  'Pikachu Rare': 'swsh-pikachu',

  // Double rare is the ordinary SV-era ex card: standard layout, normal art
  // window. It is NOT a full art — that's Ultra Rare (full-art ex) and
  // Special illustration rare. ex-regular gets the standard-layout ex
  // treatment and, unlike ex-full-art, is not in FULL_ART, so clipShape()
  // falls through to regular/stage/trainer by category instead of covering
  // the whole card. The reference confines its foil with a per-card mask and
  // no clip-path; we have no masks, so the geometric clip stands in.
  'Double rare': 'ex-regular',
  'Four Diamond': 'ex-regular',
  'Two Star': 'ex-full-art',
  'Illustration rare': 'illustration-rare',
  'One Star': 'illustration-rare',
  'Special illustration rare': 'ex-special-illustration-rare',
  'Hyper rare': 'hyper-rare',
  'Mega Hyper Rare': 'hyper-rare',
  Crown: 'hyper-rare',
};

/**
 * The rarities whose effect depends on the card's era, and the effect each
 * takes on a Scarlet & Violet or Mega card (`eraOf`); every other card takes
 * EFFECT_BY_RARITY's. SV and Mega share one rarity system, in which a plain
 * `Rare` is printed holo — the reference's CardProxy rewrites an SV `Rare` to
 * `Rare Holo` before choosing — and `Ultra Rare` is the full-art ex, where
 * before them it was the full-art V or GX. The effects page lists both arms of
 * each, qualified by era, from this table and EFFECT_BY_RARITY.
 */
export const MODERN_EFFECT_BY_RARITY: Readonly<Record<string, EffectId>> = {
  Rare: 'regular-holo',
  'Ultra Rare': 'ex-full-art',
};

/**
 * Set ids of Scarlet & Violet (`sv01` … `sv10.5w`, and the `svp` promos) and
 * Mega (`me01` … `me05`, `mep`): the "modern" era, one rarity system for both.
 * Checked against all 220 TCGdex sets, these match exactly those 17 and 7 sets,
 * and neither matches the Shiny Vault `swsh4.5sv` or McDonald's `2023sv` and
 * `2024sv`.
 */
const SV_SET = /^sv(\d|p$)/i;
const MEGA_SET = /^me(\d|p$)/i;

/**
 * The Mega sets the pattern above cannot reach: TCGdex's Mega Evolution series
 * also holds two sets whose ids do not start with `me` (GET /series/me,
 * verified 2026-09-24) — `30th` (30th Celebration) and `30th-c` (30th Classic
 * Collection) — so they are Mega by exact id. `30th`'s 18 `Rare` cards take
 * the modern arm, regular-holo, although TCGdex marks every one of them
 * `variants.holo: false`, where the Rares of the main Mega and SV sets are
 * `true`: selection follows the rarity system, and reads variant data nowhere.
 *
 * Left out on purpose, since none holds a rarity that changes with the era:
 * `sve` and `mee`, the SV and Mega basic energies (all `Common`), and `mfb`
 * (SV series, all `None`). A new set with an odd id needs the same check
 * against its series.
 */
const UNPREFIXED_MEGA_SETS: ReadonlySet<string> = new Set(['30th', '30th-c']);

/**
 * A card's set id: its id less the trailing `-${localId}`, exactly as
 * lib/images.ts#cardImageBase derives it — set ids contain hyphens (`P-A`,
 * `30th-c`), so splitting on one would not do. Empty when the id does not
 * end that way.
 */
function setIdOf(card: Pick<Card, 'id' | 'localId'>): string {
  const suffix = `-${card.localId}`;
  return card.id.endsWith(suffix) ? card.id.slice(0, -suffix.length) : '';
}

/**
 * Which arm of an era-split rarity (MODERN_EFFECT_BY_RARITY) a card takes:
 * `modern` on a Scarlet & Violet or Mega card, `older` on any other.
 */
export type Era = 'modern' | 'older';

export function eraOf(card: Pick<Card, 'id' | 'localId'>): Era {
  const setId = setIdOf(card);
  return SV_SET.test(setId) || MEGA_SET.test(setId) || UNPREFIXED_MEGA_SETS.has(setId)
    ? 'modern'
    : 'older';
}

/** 151, the one set whose reverse holos are Poké Ball and Master Ball patterned. */
const BALL_REVERSE_SET = 'sv03.5';

/**
 * The 151 cards whose reverse holo is the Master Ball pattern, by card number:
 * the reference's fixed list. The reference also promotes a random 20% of the
 * rest to Master Ball, and forces these eight to reverse whatever was asked;
 * neither happens here, so a card renders the same every time and reverse
 * stays the caller's explicit choice. TCGdex pads the numbers (`001`), so they
 * are compared as integers. The effects page names them from here.
 */
export const MASTER_BALL_NUMBERS: ReadonlySet<number> = new Set([1, 4, 7, 25, 133, 144, 146, 161]);

/** The reverse foil a card gets once the caller asks for its reverse printing. */
function reverseEffect(card: Card): EffectId {
  if (setIdOf(card) !== BALL_REVERSE_SET) return 'reverse-holo';
  return MASTER_BALL_NUMBERS.has(parseInt(card.localId, 10)) ? 'masterball-holo' : 'poke-ball-holo';
}

/**
 * Effects whose foil covers the entire card rather than an art window. For
 * ex-full-art, ex-special-illustration-rare and hyper-rare the reference has
 * no clip-path, only a per-card mask we cannot have (or `--mask: none`), so
 * with the mask gone the foil covers the card.
 */
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
  'ex-full-art',
  'ex-special-illustration-rare',
  'hyper-rare',
]);

/** Effects the reference clips to the card's rounded border, not its art. */
const BORDERS: ReadonlySet<EffectId> = new Set<EffectId>([
  'radiant-holo',
  'illustration-rare',
  'trainer-gallery-holo',
  'trainer-gallery-v-regular',
  'trainer-gallery-v-max',
  'trainer-gallery-secret-rare',
]);

/**
 * Effects a reverse printing is allowed to replace. A Scarlet & Violet or
 * Mega `Rare` counts: MODERN_EFFECT_BY_RARITY makes it regular-holo first.
 */
const REVERSIBLE: ReadonlySet<EffectId> = new Set<EffectId>(['basic', 'regular-holo']);

export interface SelectOptions {
  /**
   * True only when the app is showing the reverse printing. This is an
   * explicit display choice made by the caller — the card page's
   * normal/reverse toggle (`views/CardView.tsx`), or the effects page's
   * reverse sections (`views/EffectsView.tsx`) — never derived from the card
   * itself: `card.variants?.reverse` means "a reverse printing of this card
   * exists," not "this card is currently reversed." Conflating the two
   * rendered roughly half of TCGdex with inverted or unwarranted foil.
   * `card.variants?.reverse` still decides whether the card page offers the
   * toggle at all, and whether it honours `?variant=reverse`, just not this.
   */
  reverse?: boolean;
}

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
  // Order matters: radiant, illustration-rare and the gallery effects clip to
  // the border, and would otherwise be claimed by the full-art or trainer
  // rules below. Every reverse foil falls through to the card's own region,
  // which selectHolo inverts.
  if (BORDERS.has(effect)) return 'borders';
  if (card.rarity === 'Full Art Trainer') return 'full';
  if (FULL_ART.has(effect)) return 'full';
  if (card.category === 'Trainer') return 'trainer';
  if (card.stage === 'Stage1' || card.stage === 'Stage2') return 'stage';
  return 'regular';
}

/**
 * Which foil a card gets, where it is confined, and whether that is inverted.
 *
 * `options.reverse` is the only thing that selects a reverse foil —
 * `reverse-holo`, or on 151 `poke-ball-holo` / `masterball-holo` — see
 * `SelectOptions`. It is never read off `card.variants` directly here.
 */
export function selectHolo(card: Card, options: SelectOptions = {}): HoloSelection {
  const modern = eraOf(card) === 'modern';
  const { rarity } = card;
  let base: EffectId =
    (rarity && ((modern && MODERN_EFFECT_BY_RARITY[rarity]) || EFFECT_BY_RARITY[rarity])) ||
    'basic';

  // TCGdex files every promo — plain reprints and holo V/ex/GX chase cards
  // alike — under the single rarity 'Promo', which EFFECT_BY_RARITY maps to
  // 'basic'. The reference (CardProxy.svelte) recovers the real foil by
  // rewriting the rarity from the card's subtypes before selecting one; we
  // don't have subtypes, but `suffix` (V, ex, GX, EX, TAG TEAM-GX, ...) is
  // the same signal when TCGdex populates it, so a promo carrying one gets
  // the standard-layout holo treatment instead of rendering flat: the ex's,
  // ex-regular, on a Scarlet & Violet or Mega promo (`svp`, `mep`), and the
  // V's, v-regular, on an older one. A promo with no suffix really is
  // unfoiled and stays on 'basic'.
  //
  // This deliberately does not special-case VMAX/VSTAR promos: TCGdex's
  // `suffix` is inconsistent for them (swsh3-2 Butterfree VMAX has no
  // suffix, while swsh12-008 Serperior VSTAR has suffix "V"). Parsing the
  // card name instead would be fragile and language-dependent, so we leave
  // that gap rather than guess.
  if (base === 'basic' && rarity === 'Promo' && card.suffix) {
    base = modern ? 'ex-regular' : 'v-regular';
  }

  let effect = base;
  let invert = false;

  if (isTrainerGallery(card.localId)) {
    effect = galleryEffect(base);
  } else if (REVERSIBLE.has(base) && options.reverse) {
    effect = reverseEffect(card);
    invert = true;
  }

  return { effect, shape: clipShape(effect, card), invert };
}
