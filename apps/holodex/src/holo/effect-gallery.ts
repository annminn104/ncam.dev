import { EFFECT_BY_RARITY, type EffectId } from './select';

/**
 * The effects page (`views/EffectsView.tsx`, route `/effects`): one tile per
 * effect `selectHolo` can return, the rarities that select it, and a real card
 * that genuinely does.
 *
 * Every `cardId` here was checked by calling the real `selectHolo` on the card
 * TCGdex actually serves, never by reading a table — and
 * `effect-gallery.test.ts` keeps it that way against a captured copy of each
 * card (`effect-gallery.fixture.ts`). Swap an example only for a card that
 * passes the same check.
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
  /** A real TCGdex card id that genuinely selects this effect, or null. */
  cardId: string | null;
  /** Why this effect has no example, when cardId is null. */
  note?: string;
  /**
   * Show the card's reverse printing: passed through as
   * `selectHolo(card, { reverse })` and `<HoloCard reverse>`. reverse-holo is a
   * display choice, never read off the card, so without this its tile would
   * render `basic` under a `reverse-holo` label.
   */
  reverse?: boolean;
}

/** select.ts's two overrides, which reach the four effects no rarity maps to. */
const FROM_REVERSE_PRINTING = 'reverse printing';
const FROM_CARD_NUMBER = 'TG/GG card number';

/**
 * In page order. The two Venusaur ex stay adjacent: the same Pokémon at two
 * rarities, which must not look alike (Double rare keeps the art-window clip,
 * Ultra Rare foils the whole card).
 */
const EXAMPLES: Omit<EffectExample, 'rarities'>[] = [
  { effect: 'basic', cardId: 'sm7.5-1' }, // Charmander
  { effect: 'regular-holo', cardId: 'swsh3-25' }, // Heatran, a Basic: the plain `regular` clip
  { effect: 'cosmos-holo', cardId: 'cel25cc-CC001' }, // Blastoise
  { effect: 'amazing-rare', cardId: 'swsh4-9' }, // Celebi
  { effect: 'radiant-holo', cardId: 'swsh10.5-004' }, // Radiant Venusaur
  { effect: 'rainbow-holo', cardId: 'sv06.5-095' }, // Pecharunt ex
  { effect: 'rainbow-alt', cardId: 'A1a-085' }, // Celebi ex
  { effect: 'secret-rare', cardId: 'sv06.5-090' }, // Okidogi ex
  { effect: 'shiny-rare', cardId: 'sv04.5-092' }, // Oddish
  { effect: 'shiny-v', cardId: 'swsh4.5sv-SV105' }, // Rillaboom V
  { effect: 'shiny-vmax', cardId: 'swsh4.5sv-SV106' }, // Rillaboom VMAX
  { effect: 'v-regular', cardId: 'sv03.5-003' }, // Venusaur ex, Double rare: the ordinary ex
  { effect: 'v-full-art', cardId: 'sv03.5-182' }, // Venusaur ex, Ultra Rare: the real full art
  { effect: 'v-max', cardId: 'swsh3-2' }, // Butterfree VMAX
  { effect: 'v-star', cardId: 'swsh12-008' }, // Serperior VSTAR
  { effect: 'trainer-gallery-holo', cardId: 'sv03.5-166' }, // Bulbasaur, Illustration rare
  { effect: 'swsh-pikachu', cardId: '30th-023' }, // Pikachu
  // Paras: a Common that has a reverse printing, shown as that printing.
  { effect: 'reverse-holo', cardId: 'swsh3-3', reverse: true, override: FROM_REVERSE_PRINTING },
  { effect: 'trainer-gallery-v-regular', cardId: 'swsh12tg-TG12', override: FROM_CARD_NUMBER }, // Kricketune V
  { effect: 'trainer-gallery-v-max', cardId: 'swsh12tg-TG15', override: FROM_CARD_NUMBER }, // Blaziken VMAX
  { effect: 'trainer-gallery-secret-rare', cardId: 'swsh12tg-TG29', override: FROM_CARD_NUMBER }, // Rayquaza VMAX
  { effect: 'trainer-full-art', cardId: 'swsh12tg-TG23' }, // Friends in Galar
];

/** Read off the table rather than typed out, so the page cannot drift from it. */
function raritiesFor(effect: EffectId): string[] {
  return Object.keys(EFFECT_BY_RARITY).filter((rarity) => EFFECT_BY_RARITY[rarity] === effect);
}

export const EFFECT_GALLERY: readonly EffectExample[] = EXAMPLES.map((example) => ({
  ...example,
  rarities: raritiesFor(example.effect),
}));

/** Whether `/effects/<value>` names a tile. Anything else falls back to the default tile. */
export function isGalleryEffect(value: string): value is EffectId {
  return EFFECT_GALLERY.some((entry) => entry.effect === value);
}

/**
 * The tile the page renders live: the one the route names, or else the first
 * entry that has a card to show.
 */
export function selectedExample(
  effect: EffectId | undefined,
  gallery: readonly EffectExample[] = EFFECT_GALLERY,
): EffectExample {
  return (
    gallery.find((entry) => entry.effect === effect) ??
    gallery.find((entry) => entry.cardId !== null) ??
    gallery[0]
  );
}
