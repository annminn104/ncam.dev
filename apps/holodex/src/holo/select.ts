import type { Card } from '../lib/tcgdex';
import type { CardLayout } from './regions';

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
  | 'masterball-holo'
  | 'sv-rare-holo';

/** Which part of the card the foil is confined to. */
export type ClipShape = 'regular' | 'stage' | 'trainer' | 'borders' | 'full';

export interface HoloSelection {
  effect: EffectId;
  shape: ClipShape;
  /**
   * The frame the card is printed in (layoutOf), which places the art window
   * of `regular` and `stage` and cuts out what it prints over the art
   * (regions.ts). The other shapes are the same on every card.
   */
  layout: CardLayout;
  /**
   * Foil everywhere EXCEPT the region: the reverse foils, and ex-regular,
   * whose reference foils an ex but its Pokémon (INVERTED).
   */
  invert: boolean;
  /**
   * The card's --card-glow (glowOf), for an effect whose stops are part glow
   * (types.ts's GradientStop.glow, the shader's uCardGlow): radiant-holo's.
   */
  glow: [number, number, number];
  /**
   * The card's --foil-brightness (foilBrightnessOf), for an effect whose
   * filter reads it (types.ts's PointerDriven.fromFoilBrightness, the shader's
   * uFoilBrightness): reverse-holo's.
   */
  foilBrightness: number;
}

/**
 * base.css's --card-glow, which pokemon-cards-css classes a card by its type
 * (`.card.water` and the rest), as RGB 0..1: its hsl() values converted, and
 * Fighting's rgb(). select.test.ts holds each to css.ts#hsl. A card is keyed
 * by its first type; anything else, Colorless and trainers included, keeps
 * :root's.
 */
const GLOW_BY_TYPE: Readonly<Record<string, [number, number, number]>> = {
  Water: [0.212, 0.8328, 0.988],
  Fire: [0.9221, 0.3575, 0.2579],
  Grass: [0.5933, 0.9335, 0.3665],
  Lightning: [0.9519, 0.8875, 0.3081],
  Psychic: [0.6755, 0.3196, 0.8404],
  Fighting: [0.5686, 0.3529, 0.1529],
  Darkness: [0.0621, 0.4155, 0.4779],
  Metal: [0.64, 0.752, 0.76],
  Dragon: [0.56, 0.497, 0.14],
  Fairy: [1, 0.78, 0.9157],
};

/** :root's --card-glow, hsl(175, 100%, 90%). */
export const DEFAULT_GLOW: [number, number, number] = [0.8, 1, 0.9833];

/** The card's --card-glow, by its first type. */
export function glowOf(card: Card): [number, number, number] {
  return GLOW_BY_TYPE[card.types?.[0] ?? ''] ?? DEFAULT_GLOW;
}

/**
 * reverse-holo.css's --foil-brightness: 0.55, and brighter for the three types
 * it classes apart (`.card.lightning` and the rest), keyed by the card's first
 * type as the glow is.
 */
const FOIL_BRIGHTNESS_BY_TYPE: Readonly<Record<string, number>> = {
  Lightning: 0.7,
  Darkness: 0.8,
  Metal: 0.6,
};

/** reverse-holo.css's own --foil-brightness. */
export const DEFAULT_FOIL_BRIGHTNESS = 0.55;

/** The card's --foil-brightness, by its first type. */
export function foilBrightnessOf(card: Card): number {
  return FOIL_BRIGHTNESS_BY_TYPE[card.types?.[0] ?? ''] ?? DEFAULT_FOIL_BRIGHTNESS;
}

/**
 * Effects with no rarity of their own. The three reverse foils come from the
 * caller's explicit `variant` (SelectOptions), never from the card:
 * `masterball` is `masterball-holo`, and `reverse` is `reverse-holo` unless
 * reverseEffect finds the printing Poké Ball or Master Ball patterned (151's
 * by set, or a Poké Ball printing TCGdex lists). The four gallery effects
 * come from the card number — `trainer-gallery-holo` too, now that
 * `Illustration rare`, the one rarity that used to select it, selects
 * `illustration-rare`. A test asserts this list is exactly the set of effects
 * missing from EFFECT_BY_RARITY.
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
  // Pocket's holo rare, in the Scarlet & Violet look Pocket shares
  'Three Diamond': 'sv-rare-holo',

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
  // no clip-path; we have no masks, so the geometric clip stands in,
  // inverted (INVERTED): the card less the ex frame's art (layoutOf).
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
 * `Rare Holo` before choosing, and draws it with pokemon-cards-151's own
 * regular holo, sv-rare-holo, not pokemon-cards-css's scanlines — and `Ultra
 * Rare` is the full-art ex, where before them it was the full-art V or GX. The
 * effects page lists both arms of each, qualified by era, from this table and
 * EFFECT_BY_RARITY.
 */
export const MODERN_EFFECT_BY_RARITY: Readonly<Record<string, EffectId>> = {
  Rare: 'sv-rare-holo',
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
 * the modern arm, sv-rare-holo. TCGdex marks them `variants.holo: false`, but
 * that is a new set's placeholder rather than a printing: every `30th` card
 * reads `normal: true, holo: false, reverse: false`, its Double, Illustration
 * and Special illustration rares included — foil by definition, and `holo:
 * true` in `me02` and `sv08` (checked 2026-09-24). Selection follows the
 * rarity system; the one variant datum it reads is a listed Poké Ball
 * printing (listsReverseFoil), whose absence is safe.
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

/**
 * The frame each set prints its cards in, by set id, for regions.ts's
 * measured layouts. Checked against every set of all 21 TCGdex series (GET
 * /series/{id}, 2026-09-25; select.test.ts holds the whole list): each series'
 * sets land in its frame — the promos, trainer kits (`tk-ex-…`, `tk-hs-…`),
 * POP Series (1–5 the EX frame, 6–9 Diamond & Pearl's) and McDonald's
 * collections (by year) in their era's; Scarlet & Violet and Mega share one,
 * 30th Celebration included, and Pocket's sets (`A1` … `B2a`, `P-A`) have
 * theirs. Left to `other`: `ru1`, Pokémon Rumble's own frame; the SV and
 * Mega energies (`sve`, `mee`) and `mfb`, none of which draws a foil;
 * `30th-c`, whose reprints keep their old frames and draw none either; and the
 * sets with no card art (`sp`, `bog`, `jumbo`, `miscp`). A new Pocket series
 * (`C1`, say) needs adding.
 */
const LAYOUT_BY_SET: ReadonlyArray<readonly [RegExp, CardLayout]> = [
  [/^(?:base\d|basep|wp|gym\d|neo\d|si1|lc)$/, 'wotc'],
  [/^ecard\d$/, 'e-card'],
  [/^(?:ex\d+|ex5\.5|exu|np|pop[1-5]|tk-ex-\w+)$/, 'ex'],
  [/^(?:dp\d|dpp|pl\d|pop[6-9]|tk-dp-\w+)$/, 'dp'],
  [/^(?:hgss\d|hgssp|col1|tk-hs-\w+)$/, 'hgss'],
  [/^(?:bw\d+|bwp|dv1|rc|xy\d+|xy[pa]|dc1|g1|201[12]bw|201[456]xy|tk-(?:bw|xy)-\w+)$/, 'bw-xy'],
  [/^(?:sm\d+|sm[37]\.5|smp|sma|det1|201[789]sm|tk-sm-\w+)$/, 'sm'],
  [/^(?:swsh.*|fut2020|cel25(?:cc)?|202[12]swsh)$/, 'swsh'],
  [/^(?:sv(?:\d|p$).*|me(?:\d|p$).*|30th|202[34]sv)$/, 'sv'],
  [/^(?:[AB]\d+[ab]?|P-A)$/, 'pocket'],
];

/**
 * A Pokémon ex of Scarlet & Violet, Mega or Pocket, by its name: TCGdex's
 * `suffix` says `ex` or `EX` on most of them but not on all (Mega Charizard
 * X ex and Oricorio ex, of me02, have none; checked 2026-09-25), and every
 * one of their names ends so. Their frame is the illustration border to
 * border (regions.ts's `modern-ex`).
 */
const MODERN_EX_NAME = / ex$/;

/**
 * The rarities that bring a frame of their own, whatever the set: a LV.X's,
 * a Prime's and a LEGEND half's.
 */
const LAYOUT_BY_RARITY: Readonly<Record<string, CardLayout>> = {
  'Rare Holo LV.X': 'lv-x',
  'Rare PRIME': 'prime',
  LEGEND: 'legend',
};

/**
 * Platinum's SP Pokémon, named for their owner's title: G (Team Galactic),
 * GL (Gym Leader), E4 (Elite Four), FB (Frontier Brain) and C (Champion).
 * TCGdex marks one `suffix: 'SP'` only now and then — Absol G has it,
 * Drifblim FB not (checked 2026-09-25) — so the name decides, in the four
 * Platinum sets and the DP promos alone. There it matches 103 cards, the SP
 * Pokémon and one Trainer (whose clip takes no layout); in Diamond & Pearl
 * proper it would match Unown C and Unown G. An SP LV.X is a LV.X first.
 */
const SP_NAME = / (?:G|GL|E4|FB|C)(?: LV\.X)?$/;
const SP_SET = /^(?:pl\d|dpp)$/;

/** Which frame a card is printed in: regions.ts's CardLayout. */
export function layoutOf(card: Pick<Card, 'id' | 'localId' | 'name' | 'rarity'>): CardLayout {
  const byRarity = card.rarity && LAYOUT_BY_RARITY[card.rarity];
  if (byRarity) return byRarity;
  const setId = setIdOf(card);
  if (SP_SET.test(setId) && SP_NAME.test(card.name)) return 'dp-sp';
  const bySet = LAYOUT_BY_SET.find(([pattern]) => pattern.test(setId))?.[1] ?? 'other';
  if ((bySet === 'sv' || bySet === 'pocket') && MODERN_EX_NAME.test(card.name)) return 'modern-ex';
  return bySet;
}

/**
 * 151, whose reverse holos the reference draws Poké Ball and Master Ball
 * patterned. TCGdex lists no ball printing for the English 151 (its reverses
 * are plain, four with a cosmos one besides; checked 2026-09-25), so this is
 * the reference's look, kept by set.
 */
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

/**
 * Whether TCGdex lists a reverse printing of this card with this foil pattern:
 * a `variants_detailed` entry of type `reverse` with `foil` set to it.
 * Prismatic Evolutions, Black Bolt and White Flare list a `pokeball` one for
 * every Common, Uncommon and Rare, and a `masterball` one for most, and
 * Ascended Heroes a `pokeball` one for its cards whose ball is the Poké Ball;
 * its others name a Friend, Love, Quick or Dusk Ball or Team Rocket's R, which
 * have no pattern here, or no ball at all, and so stay plain (checked
 * 2026-09-25). Plain reverse draws the Poké Ball; the Master Ball is its own
 * printing (`variant: 'masterball'`), which the card page offers only where
 * this finds one. This is the one variant datum selection reads, and a safe
 * one: it is there only where TCGdex curated it, and its absence, a
 * placeholder set's included, means a plain reverse, never a wrong pattern.
 */
export function listsReverseFoil(card: Card, foil: 'pokeball' | 'masterball'): boolean {
  return card.variants_detailed?.some((v) => v.type === 'reverse' && v.foil === foil) ?? false;
}

/** The reverse foil a card gets once the caller asks for its reverse printing. */
function reverseEffect(card: Card): EffectId {
  if (setIdOf(card) === BALL_REVERSE_SET) {
    return MASTER_BALL_NUMBERS.has(parseInt(card.localId, 10))
      ? 'masterball-holo'
      : 'poke-ball-holo';
  }
  return listsReverseFoil(card, 'pokeball') ? 'poke-ball-holo' : 'reverse-holo';
}

/**
 * Effects whose foil covers the entire card rather than an art window. For
 * ex-full-art, ex-special-illustration-rare and hyper-rare the reference has
 * no clip-path, only a per-card mask we cannot have (or `--mask: none`), so
 * with the mask gone the foil covers the card; for the older effects, the
 * shine ports (legacy-shines.test.ts) take the clip-path pokemon-cards-css's
 * unmasked path computes, which for these is none. A gallery V is styled by
 * v-full-art.css's rules and a gallery VMAX by rainbow-alt.css's, so they are
 * unclipped too, as is a gallery secret rare. cosmos-holo departs from its
 * CSS, which clips the shine to the card's own region: the owner's call
 * (2026-09-25), as a Black White Rare is foiled over the whole card. The
 * Classic Collection cards it also covers have no art, so draw no scene.
 */
const FULL_ART: ReadonlySet<EffectId> = new Set<EffectId>([
  'cosmos-holo',
  'v-full-art',
  'trainer-gallery-v-regular',
  'trainer-gallery-v-max',
  'trainer-gallery-secret-rare',
  'secret-rare',
  'rainbow-holo',
  'rainbow-alt',
  'shiny-v',
  'shiny-vmax',
  'v-regular',
  'v-max',
  'v-star',
  'swsh-pikachu',
  'ex-full-art',
  'ex-special-illustration-rare',
  'hyper-rare',
]);

/**
 * Effects the reference clips to the card's rounded border, not its art. A
 * shiny rare is neither: shiny-rare.css clips it to the card's own region
 * (--clip, or --clip-stage on an evolution), which the rules below give it.
 */
const BORDERS: ReadonlySet<EffectId> = new Set<EffectId>([
  'radiant-holo',
  'illustration-rare',
  'trainer-gallery-holo',
]);

/**
 * Effects the reference clips to the art window whatever the card:
 * amazing-rare.css's unmasked rule sets `--clip` with no stage variant.
 */
const ART_WINDOW: ReadonlySet<EffectId> = new Set<EffectId>(['amazing-rare']);

/**
 * Effects that foil the card less their region, whatever the printing:
 * ex-regular. Its reference confines the foil with a per-card mask, the
 * card's own foil layer, which lets it through everywhere but the Pokémon;
 * against six of 151's (2026-09-25), the card less its art window matched
 * two thirds of every mask, where the art window alone, this clip until then,
 * matched a fifth. The owner's call. Nothing else takes it: a reverse foil
 * inverts because its printing is asked for (SelectOptions).
 */
const INVERTED: ReadonlySet<EffectId> = new Set<EffectId>(['ex-regular']);

/**
 * Effects a reverse printing is allowed to replace. A Scarlet & Violet or
 * Mega `Rare` counts: MODERN_EFFECT_BY_RARITY makes it sv-rare-holo first.
 */
const REVERSIBLE: ReadonlySet<EffectId> = new Set<EffectId>([
  'basic',
  'regular-holo',
  'sv-rare-holo',
]);

/** A printing the app can show other than the normal one. */
export type Printing = 'reverse' | 'masterball';

export interface SelectOptions {
  /**
   * The printing the app is showing, left out for the normal one: `reverse`,
   * or `masterball`, the Master Ball-patterned reverse some sets print beside
   * the Poké Ball one. This is an explicit display choice made by the caller
   * — the card page's printing toggle (`views/CardView.tsx`), or the effects
   * page's reverse sections (`views/EffectsView.tsx`) — never derived from
   * the card itself: `card.variants?.reverse` means "a reverse printing of
   * this card exists," not "this card is currently reversed." Conflating the
   * two rendered roughly half of TCGdex with inverted or unwarranted foil.
   * What the card lists still decides which buttons the card page offers,
   * and which `?variant=` it honours, just not this.
   */
  variant?: Printing;
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
  if (ART_WINDOW.has(effect)) return 'regular';
  if (card.rarity === 'Full Art Trainer') return 'full';
  if (FULL_ART.has(effect)) return 'full';
  if (card.category === 'Trainer') return 'trainer';
  if (card.stage === 'Stage1' || card.stage === 'Stage2') return 'stage';
  return 'regular';
}

/**
 * Which foil a card gets, where it is confined, and whether that is inverted.
 *
 * `options.variant` is the only thing that selects a reverse foil: `reverse`
 * draws `reverse-holo`, or `poke-ball-holo` / `masterball-holo` on 151 and
 * `poke-ball-holo` where TCGdex lists a Poké Ball printing (`reverseEffect`);
 * `masterball` draws `masterball-holo`. See `SelectOptions`. Which printing
 * to show is never read off the card.
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
  } else if (REVERSIBLE.has(base) && options.variant) {
    effect = options.variant === 'masterball' ? 'masterball-holo' : reverseEffect(card);
    invert = true;
  } else if (INVERTED.has(effect)) {
    invert = true;
  }

  return {
    effect,
    shape: clipShape(effect, card),
    layout: layoutOf(card),
    invert,
    glow: glowOf(card),
    foilBrightness: foilBrightnessOf(card),
  };
}
