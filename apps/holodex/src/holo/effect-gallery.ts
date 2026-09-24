import { EFFECT_BY_RARITY, type EffectId } from './select';

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
export interface EffectExample {
  effect: EffectId;
  /** Every rarity in EFFECT_BY_RARITY that selects this effect. */
  rarities: string[];
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
   * `selectHolo(card, { reverse })` and `<HoloCard reverse>`. reverse-holo is
   * a display choice, never read off the card, so without this its section
   * would render `basic` under a `reverse-holo` heading.
   */
  reverse?: boolean;
}

/** select.ts's two overrides, which reach the four effects no rarity maps to. */
const FROM_REVERSE_PRINTING = 'reverse printing';
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
  {
    effect: 'regular-holo',
    cardIds: [
      'hgss4-1', // Aggron
      'hgss3-1', // Bellossom
      'hgss2-1', // Jirachi
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
  {
    effect: 'rainbow-holo',
    cardIds: [
      'sv06.5-095', // Pecharunt ex
      'me05-120', // Mega Darkrai ex
      'me04-122', // Mega Greninja ex
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
      'B1a-089', // Gloom
      'A3a-089', // Growlithe
    ],
  },
  // Each card judged on its own rarity (Shiny rare V, Shiny Ultra Rare), never
  // on a `?rarity=Shiny rare V` search, whose substring match returns the
  // Shiny rare VMAX cards too: that is how a VMAX once got in here.
  {
    effect: 'shiny-v',
    cardIds: [
      'swsh4.5sv-SV105', // Rillaboom V
      'sv04.5-212', // Forretress ex
      'swsh4.5sv-SV108', // Centiskorch V
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
  // One card per way into v-regular: Double rare, a Promo, and Holo Rare V.
  // svp-004 is there deliberately, to exercise selectHolo's promo upgrade:
  // TCGdex files it under `Promo`, which the table maps to basic, and only its
  // `suffix: 'ex'` lifts it to v-regular.
  //
  // The two Venusaur ex open v-regular and v-full-art, which stay adjacent:
  // the same Pokémon at two rarities, which must not look alike (Double rare
  // keeps the art-window clip, Ultra Rare foils the whole card).
  {
    effect: 'v-regular',
    cardIds: [
      'sv03.5-003', // Venusaur ex, Double rare
      'svp-004', // Mimikyu ex, Promo
      'swsh1-1', // Celebi V, Holo Rare V
    ],
  },
  {
    effect: 'v-full-art',
    cardIds: [
      'sv03.5-182', // Venusaur ex, Ultra Rare
      'sm9-1', // Celebi & Venusaur GX
      'sm10-1', // Pheromosa & Buzzwole GX
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
  {
    effect: 'trainer-gallery-holo',
    cardIds: [
      'sv06.5-065', // Tapu Bulu
      'me05-085', // Fomantis
      'me04-087', // Chespin
    ],
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
      'swsh11tg-TG29', // Pikachu VMAX
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
];

/** Read off the table rather than typed out, so the page cannot drift from it. */
function raritiesFor(effect: EffectId): string[] {
  return Object.keys(EFFECT_BY_RARITY).filter((rarity) => EFFECT_BY_RARITY[rarity] === effect);
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
