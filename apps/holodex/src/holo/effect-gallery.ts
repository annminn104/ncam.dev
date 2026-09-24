import {
  EFFECT_BY_RARITY,
  MASTER_BALL_NUMBERS,
  MODERN_EFFECT_BY_RARITY,
  type EffectId,
  type Era,
} from './select';

/**
 * The effects page (`views/EffectsView.tsx`, route `/effects`): one section per
 * effect `selectHolo` can return, the rarities that select it, and three real
 * cards that genuinely do.
 *
 * Every card here was checked by calling the real `selectHolo` on the card
 * TCGdex actually serves — on its own rarity, never on the one it was searched
 * by: TCGdex's `?rarity=` filter is a substring match, so a search for `Shiny
 * rare V` also returns `Shiny rare VMAX` cards, and an earlier draft of this
 * list put a VMAX under shiny-v exactly that way. `effect-gallery.test.ts`
 * keeps it honest against a captured copy of each card
 * (`effect-gallery.fixture.ts`). Swap a card only for one that passes the same
 * check — and that has art, since HoloCard draws no foil without it:
 * `lib/images.ts#cardImageBase` must find a base for it, which the same test
 * file checks for every card. The subset-set cards (the Shiny Vault's
 * `swsh4.5sv` and the `swsh9tg`–`swsh12tg` Trainer Galleries) have art only
 * through cardImageBase: the API serves them with no `image` at all, although
 * the art exists under the parent set's path.
 *
 * Pure data over `select.ts`, which is already in the main chunk. Importing
 * `./scene`, `./effects` or three.js from here would drag the lazy holo chunk
 * into every page.
 */

/**
 * One way into an effect: a rarity, and for a rarity whose effect depends on
 * the card's era (MODERN_EFFECT_BY_RARITY), which arm this is.
 */
export interface RarityArm {
  rarity: string;
  /** Absent for a rarity that selects the same effect in every era. */
  era?: Era;
}

export interface EffectExample {
  effect: EffectId;
  /**
   * Every (rarity, era arm) that selects this effect, read off select.ts's two
   * tables (`raritiesFor`). Each is on the page exactly once: a rarity with no
   * era split in one section, an era-split one in two, once per arm.
   */
  rarities: RarityArm[];
  /**
   * How an override-only effect is reached, shown in place of its rarity
   * list: these effects have no rarity of their own (OVERRIDE_ONLY_EFFECTS).
   */
  override?: string;
  /**
   * Three real TCGdex card ids that genuinely select this effect, in the order
   * the section shows them; `/effects/<effect>` opens on the first. A tuple,
   * so "three" is the type, not a convention.
   */
  cardIds: readonly [string, string, string];
  /**
   * Show every card's reverse printing: passed through as
   * `selectHolo(card, { reverse })` and `<HoloCard reverse>`. A reverse foil
   * is a display choice, never read off the card, so without this the three
   * reverse sections would render `basic` under their headings.
   */
  reverse?: boolean;
}

/**
 * What qualifies each arm of an era-split rarity on the page. `modern` is what
 * select.ts's `eraOf` calls modern: the Scarlet & Violet and Mega sets. `older`
 * is every other set, which for the rarities split today — Rare and Ultra
 * Rare — means the cards from before Scarlet & Violet.
 */
export const ERA_QUALIFIER: Readonly<Record<Era, string>> = {
  modern: 'Scarlet & Violet, Mega',
  older: 'before Scarlet & Violet',
};

/** select.ts's two overrides, which reach the seven effects no rarity maps to. */
const FROM_REVERSE_PRINTING = 'reverse printing, any set but 151';
const FROM_POKE_BALL_REVERSE = 'reverse printing, 151';
const FROM_MASTER_BALL_REVERSE = `reverse printing, 151 nos. ${[...MASTER_BALL_NUMBERS].join(', ')}`;
const FROM_CARD_NUMBER = 'TG/GG card number';

/** In page order, each section's cards in the order it shows them. */
const EXAMPLES: Omit<EffectExample, 'rarities'>[] = [
  {
    effect: 'basic',
    cardIds: [
      'sm1-1', // Caterpie
      'det1-1', // Bulbasaur
      'sm7-1', // Bellsprout
    ],
  },
  // One card per way in: a classic Holo Rare, a 151 Rare (Scarlet & Violet
  // prints its Rares holo, so they come here, not to basic) and Pocket's
  // Three Diamond.
  {
    effect: 'regular-holo',
    cardIds: [
      'hgss4-1', // Aggron, Holo Rare
      'sv03.5-026', // Raichu, Rare
      'A1-003', // Venusaur, Three Diamond
    ],
  },
  // Close to the ceiling: of the 29 cards that select cosmos-holo, only these
  // three and sv10.5w-172 have art. The other 25 are the Classic Collection
  // (cel25cc), which cardImageBase deliberately leaves without any.
  {
    effect: 'cosmos-holo',
    cardIds: [
      'sv10.5b-171', // Victini
      'sv10.5w-173', // Reshiram ex
      'sv10.5b-172', // Zekrom ex
    ],
  },
  {
    effect: 'amazing-rare',
    cardIds: [
      'swsh4-9', // Celebi
      'swsh4.5-17', // Reshiram
      'swsh4.5-21', // Kyogre
    ],
  },
  {
    effect: 'radiant-holo',
    cardIds: [
      'swsh10.5-004', // Radiant Venusaur
      'swsh12-016', // Radiant Tsareena
      'swsh12.5-020', // Radiant Charizard
    ],
  },
  // ACE SPEC Rare, the one rarity left on rainbow-holo since the gold tier
  // moved to hyper-rare.
  {
    effect: 'rainbow-holo',
    cardIds: [
      'sv06.5-058', // Dangerous Laser
      'sv08.5-116', // Max Rod
      'sv07-134', // Deluxe Bomb
    ],
  },
  {
    effect: 'rainbow-alt',
    cardIds: [
      '30th-157', // Mewtwo ex
      'A1a-085', // Celebi ex
      'B1a-087', // Mega Charizard Y ex
    ],
  },
  {
    effect: 'secret-rare',
    cardIds: [
      'sm115-69', // Moltres & Zapdos & Articuno GX
      'swsh4.5-73', // Alcremie VMAX
      'swsh3.5-74', // Charizard VMAX
    ],
  },
  {
    effect: 'shiny-rare',
    cardIds: [
      'sv04.5-092', // Oddish
      'sma-SV71', // Guzzlord-GX
      'B1a-089', // Gloom
    ],
  },
  // Each card judged on its own rarity (Shiny rare V, Shiny Ultra Rare, Two
  // Shiny), never on a `?rarity=Shiny rare V` search, whose substring match
  // returns the Shiny rare VMAX cards too: that is how a VMAX once got in here.
  {
    effect: 'shiny-v',
    cardIds: [
      'swsh4.5sv-SV105', // Rillaboom V
      'sv04.5-212', // Forretress ex
      'B1a-098', // Buzzwole ex
    ],
  },
  // One set by necessity, not carelessness: all seven Shiny rare VMAX cards
  // TCGdex has are in the Shiny Vault, swsh4.5sv.
  {
    effect: 'shiny-vmax',
    cardIds: [
      'swsh4.5sv-SV106', // Rillaboom VMAX
      'swsh4.5sv-SV107', // Charizard VMAX
      'swsh4.5sv-SV109', // Centiskorch VMAX
    ],
  },
  // xyp-XY84 is there deliberately, to exercise selectHolo's promo upgrade:
  // TCGdex files it under `Promo`, which the table maps to basic, and only its
  // `suffix: 'EX'` lifts it to v-regular. It is an older promo; a Scarlet &
  // Violet or Mega one goes to ex-regular instead.
  {
    effect: 'v-regular',
    cardIds: [
      'xyp-XY84', // Pikachu EX, Promo
      'swsh3.5-1', // Venusaur V, Holo Rare V
      'swsh1-1', // Celebi V, Holo Rare V
    ],
  },
  // Ultra Rare from before Scarlet & Violet, which is the full-art V or GX.
  {
    effect: 'v-full-art',
    cardIds: [
      'sm9-1', // Celebi & Venusaur GX
      'sm10-1', // Pheromosa & Buzzwole GX
      'sm12-1', // Venusaur & Snivy GX
    ],
  },
  {
    effect: 'v-max',
    cardIds: [
      'swsh3-2', // Butterfree VMAX
      'cel25-7', // Flying Pikachu VMAX
      'swsh6-8', // Celebi VMAX
    ],
  },
  {
    effect: 'v-star',
    cardIds: [
      'swsh12-008', // Serperior VSTAR
      'swsh12.5-014', // Leafeon VSTAR
      'swsh9-014', // Shaymin VSTAR
    ],
  },
  // Reached only through the card number now that Illustration rare, the
  // rarity that used to select it, has illustration-rare: a gallery card whose
  // own effect has no gallery variant lands here, like these two Ultra Rare
  // trainers and a Holo Rare.
  {
    effect: 'trainer-gallery-holo',
    cardIds: [
      'swsh10tg-TG28', // Piers
      'swsh11tg-TG28', // Opal
      'swsh12tg-TG05', // Gardevoir
    ],
    override: FROM_CARD_NUMBER,
  },
  // One name by necessity, not carelessness: all 30 Pikachu Rare cards TCGdex
  // has are named "Pikachu".
  {
    effect: 'swsh-pikachu',
    cardIds: [
      '30th-023', // Pikachu
      '30th-024', // Pikachu
      '30th-025', // Pikachu
    ],
  },
  // A Common and two Uncommons, each with a reverse printing. `reverse: true`
  // is what makes all three reverse-holo, passed through to HoloCard: reverse
  // is a display choice, never derived from the card, so without it every one
  // of them renders basic.
  {
    effect: 'reverse-holo',
    cardIds: [
      'swsh3-3', // Paras
      'swsh3-4', // Parasect
      'swsh3-5', // Carnivine
    ],
    reverse: true,
    override: FROM_REVERSE_PRINTING,
  },
  {
    effect: 'trainer-gallery-v-regular',
    cardIds: [
      'swsh12tg-TG12', // Kricketune V
      'swsh12tg-TG13', // Serperior V
      'swsh12tg-TG14', // Blaziken V
    ],
    override: FROM_CARD_NUMBER,
  },
  // Close to the ceiling: exactly four TCGdex cards select
  // trainer-gallery-v-max, these three and swsh12tg-TG21, all in one set.
  {
    effect: 'trainer-gallery-v-max',
    cardIds: [
      'swsh12tg-TG15', // Blaziken VMAX
      'swsh12tg-TG19', // Corviknight VMAX
      'swsh12tg-TG20', // Rayquaza VMAX
    ],
    override: FROM_CARD_NUMBER,
  },
  {
    effect: 'trainer-gallery-secret-rare',
    cardIds: [
      'swsh9tg-TG29', // Single Strike Urshifu VMAX
      'swsh10tg-TG29', // Ice Rider Calyrex VMAX
      'swsh12tg-TG29', // Rayquaza VMAX
    ],
    override: FROM_CARD_NUMBER,
  },
  // One set by necessity, not carelessness: all six Full Art Trainer cards
  // TCGdex has are in swsh12tg.
  {
    effect: 'trainer-full-art',
    cardIds: [
      'swsh12tg-TG23', // Friends in Galar
      'swsh12tg-TG24', // Gordie
      'swsh12tg-TG25', // Judge
    ],
  },
  // The seven Scarlet & Violet effects, ported from simeydotme/pokemon-cards-151,
  // on 151 cards throughout — its three starters at every tier that has them —
  // so each tile can be held against the identical card on poke-151.simey.me,
  // the reference's own demo. Keep it that way when swapping a card.
  //
  // The two Venusaur ex open ex-regular and ex-full-art, which stay adjacent:
  // the same Pokémon at two rarities, which must not look alike (Double rare
  // keeps the art-window clip, Ultra Rare foils the whole card).
  {
    effect: 'ex-regular',
    cardIds: [
      'sv03.5-003', // Venusaur ex, Double rare
      'sv03.5-006', // Charizard ex
      'sv03.5-009', // Blastoise ex
    ],
  },
  {
    effect: 'ex-full-art',
    cardIds: [
      'sv03.5-182', // Venusaur ex, Ultra Rare
      'sv03.5-183', // Charizard ex
      'sv03.5-184', // Blastoise ex
    ],
  },
  {
    effect: 'illustration-rare',
    cardIds: [
      'sv03.5-166', // Bulbasaur
      'sv03.5-168', // Charmander
      'sv03.5-170', // Squirtle
    ],
  },
  {
    effect: 'ex-special-illustration-rare',
    cardIds: [
      'sv03.5-198', // Venusaur ex
      'sv03.5-199', // Charizard ex
      'sv03.5-200', // Blastoise ex
    ],
  },
  // No starters by necessity, not carelessness: these are the only three Hyper
  // rares 151 has.
  {
    effect: 'hyper-rare',
    cardIds: [
      'sv03.5-205', // Mew ex
      'sv03.5-206', // Switch
      'sv03.5-207', // Basic Psychic Energy
    ],
  },
  // 151's reverse holos, Poké Ball patterned, and Master Ball for the card
  // numbers select.ts lists; the Master Ball list holds the three starters'
  // first stages, so the two sections split each line between them. Both
  // need `reverse: true`, as reverse-holo does.
  {
    effect: 'poke-ball-holo',
    cardIds: [
      'sv03.5-002', // Ivysaur
      'sv03.5-005', // Charmeleon
      'sv03.5-008', // Wartortle
    ],
    reverse: true,
    override: FROM_POKE_BALL_REVERSE,
  },
  {
    effect: 'masterball-holo',
    cardIds: [
      'sv03.5-001', // Bulbasaur
      'sv03.5-004', // Charmander
      'sv03.5-007', // Squirtle
    ],
    reverse: true,
    override: FROM_MASTER_BALL_REVERSE,
  },
];

/**
 * Every (rarity, era arm) that selects `effect`, read off select.ts's own two
 * tables rather than typed out, so the page cannot drift from them. A rarity
 * MODERN_EFFECT_BY_RARITY lists splits in two: its modern arm selects the
 * effect that table gives it, its older arm EFFECT_BY_RARITY's. Every other
 * rarity selects its EFFECT_BY_RARITY effect in every era, unqualified.
 */
function raritiesFor(effect: EffectId): RarityArm[] {
  return Object.keys(EFFECT_BY_RARITY).flatMap((rarity): RarityArm[] => {
    if (!Object.hasOwn(MODERN_EFFECT_BY_RARITY, rarity)) {
      return EFFECT_BY_RARITY[rarity] === effect ? [{ rarity }] : [];
    }
    const arms: RarityArm[] = [];
    if (MODERN_EFFECT_BY_RARITY[rarity] === effect) arms.push({ rarity, era: 'modern' });
    if (EFFECT_BY_RARITY[rarity] === effect) arms.push({ rarity, era: 'older' });
    return arms;
  });
}

export const EFFECT_GALLERY: readonly EffectExample[] = EXAMPLES.map((example) => ({
  ...example,
  rarities: raritiesFor(example.effect),
}));

/** Whether `/effects/<value>` names a section. Anything else falls back to the default card. */
export function isGalleryEffect(value: string): value is EffectId {
  return EFFECT_GALLERY.some((entry) => entry.effect === value);
}

/** Whether `cardId` is one of the three cards the `effect` section shows. */
export function isSectionCard(effect: EffectId, cardId: string): boolean {
  return EFFECT_GALLERY.some((entry) => entry.effect === effect && entry.cardIds.includes(cardId));
}

/** The one card the page renders live, and the section it sits in. */
export interface GallerySelection {
  entry: EffectExample;
  cardId: string;
}

/**
 * The live card: the one the route names, in the section it names. A card
 * that is not one of that section's three falls back to the section's first,
 * and a route that names no section — or one the page has not got — to the
 * first card of the first section, whatever card it names.
 */
export function selectedCard(effect: EffectId | undefined, cardId?: string): GallerySelection {
  const entry = EFFECT_GALLERY.find((candidate) => candidate.effect === effect);
  if (!entry) return { entry: EFFECT_GALLERY[0], cardId: EFFECT_GALLERY[0].cardIds[0] };
  return { entry, cardId: entry.cardIds.find((id) => id === cardId) ?? entry.cardIds[0] };
}
