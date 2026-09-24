import { describe, expect, it } from 'vitest';
import { cardImageBase } from '../lib/images';
import { EFFECT_GALLERY, isSectionCard, selectedCard } from './effect-gallery';
import { CAPTURED_CARDS } from './effect-gallery.fixture';
import { EFFECT_BY_RARITY, OVERRIDE_ONLY_EFFECTS, selectHolo, type EffectId } from './select';

// Derived the way effects/index.test.ts derives it — from the rarity table and
// the override list, never typed out — so a newly selectable effect joins this
// set on its own, and the page fails here until it grows a section for it.
const ALL_EFFECT_IDS: EffectId[] = [
  ...new Set([...Object.values(EFFECT_BY_RARITY), ...OVERRIDE_ONLY_EFFECTS]),
];

const effects = EFFECT_GALLERY.map((entry) => entry.effect);
/** Every card on the page, with the section it sits in, in page order. */
const cards = EFFECT_GALLERY.flatMap((entry) => entry.cardIds.map((cardId) => ({ entry, cardId })));
const cardIds = cards.map(({ cardId }) => cardId);
const repeated = (values: string[]) => values.filter((value, i) => values.indexOf(value) !== i);
const section = (effect: EffectId) => EFFECT_GALLERY.find((entry) => entry.effect === effect);

describe('EFFECT_GALLERY — one section per effect, three cards each', () => {
  it('covers every effect selectHolo can return, each exactly once', () => {
    expect([...effects].sort()).toEqual([...ALL_EFFECT_IDS].sort());
  });

  it('gives every section exactly three cards', () => {
    // The tuple type says so too, but only to tsc: vitest runs this code with
    // its types stripped. By effect, so the section that is off says so.
    expect(Object.fromEntries(EFFECT_GALLERY.map((e) => [e.effect, e.cardIds.length]))).toEqual(
      Object.fromEntries(effects.map((effect) => [effect, 3])),
    );
  });

  it('never repeats an effect, or a card anywhere on the page', () => {
    expect(repeated(effects)).toEqual([]);
    expect(repeated(cardIds)).toEqual([]);
  });

  it('opens v-regular and v-full-art, side by side, on one Pokémon at two rarities', () => {
    // Both Venusaur ex: Double rare keeps the art-window clip, Ultra Rare foils
    // the whole card, and /effects/v-regular and /effects/v-full-art open on them.
    const at = (effect: EffectId) => effects.indexOf(effect);
    expect(at('v-regular')).toBeGreaterThanOrEqual(0);
    expect(at('v-full-art') - at('v-regular')).toBe(1);
    expect(section('v-regular')?.cardIds[0]).toBe('sv03.5-003');
    expect(section('v-full-art')?.cardIds[0]).toBe('sv03.5-182');
  });
});

describe('EFFECT_GALLERY — all of EFFECT_BY_RARITY', () => {
  it('lists only rarities that really select the effect they are shown under', () => {
    for (const entry of EFFECT_GALLERY) {
      for (const rarity of entry.rarities) {
        expect(EFFECT_BY_RARITY[rarity], `${entry.effect}: ${rarity}`).toBe(entry.effect);
      }
    }
  });

  it('lists every rarity in the table under exactly one section', () => {
    // The data only: a rarity missing here, or listed twice, is a section that
    // lies about what selects it. This passes whatever the page does with the
    // list; views/EffectsView.test.ts checks what the page actually renders.
    const shown = EFFECT_GALLERY.flatMap((entry) => entry.rarities);
    expect([...shown].sort()).toEqual(Object.keys(EFFECT_BY_RARITY).sort());
  });

  it('labels exactly the override-only effects as override-driven, so no section lists nothing', () => {
    const labelled = EFFECT_GALLERY.filter((entry) => entry.override).map((entry) => entry.effect);
    expect([...labelled].sort()).toEqual([...OVERRIDE_ONLY_EFFECTS].sort());
    for (const entry of EFFECT_GALLERY) {
      expect(entry.rarities.length > 0 || Boolean(entry.override), entry.effect).toBe(true);
    }
  });
});

describe('EFFECT_GALLERY — three real cards for every effect', () => {
  it('holds a captured TCGdex copy of exactly the cards it shows, each under its own id', () => {
    // Without one, the checks below would have nothing to run selectHolo on.
    expect(Object.keys(CAPTURED_CARDS).sort()).toEqual([...cardIds].sort());
    const misfiled = Object.entries(CAPTURED_CARDS).filter(([id, card]) => card.id !== id);
    expect(misfiled.map(([id]) => id)).toEqual([]);
  });

  it('gives every card its own section’s effect, through the real selectHolo', () => {
    // The check the table itself can't make, on each card's real rarity. An
    // earlier draft, built by searching TCGdex by rarity, put a Shiny rare
    // VMAX under shiny-v: `?rarity=` is a substring match. Keyed by card, so
    // every card that breaks is named. `reverse` is passed as its section
    // declares it; whether EffectsView really hands it on to HoloCard is only
    // visible on the rendered page: views/EffectsView.test.ts.
    const selects = cards.map(({ entry, cardId }) => [
      cardId,
      selectHolo(CAPTURED_CARDS[cardId], { reverse: entry.reverse }).effect,
    ]);
    expect(Object.fromEntries(selects)).toEqual(
      Object.fromEntries(cards.map(({ entry, cardId }) => [cardId, entry.effect])),
    );
  });

  it('has art for every card: the image TCGdex links, or the one cardImageBase recovers', () => {
    // None without art, and listed by card rather than counted, so the one
    // that loses its art (a card swapped in with none, or a subset set the
    // rule stops reaching) fails here by name. The subset-set cards have no
    // `image` in the fixture because TCGdex serves them with none.
    const artless = cardIds.filter((cardId) => {
      const card = CAPTURED_CARDS[cardId];
      return !card || !cardImageBase(card);
    });
    expect(artless).toEqual([]);
  });

  it('shows reverse printings only in reverse-holo, all three of them, of cards that have one', () => {
    const reversed = EFFECT_GALLERY.filter((entry) => entry.reverse);
    expect(reversed.map((entry) => entry.effect)).toEqual(['reverse-holo']);
    const withoutOne = reversed.flatMap((entry) =>
      entry.cardIds.filter((cardId) => CAPTURED_CARDS[cardId]?.variants?.reverse !== true),
    );
    expect(withoutOne).toEqual([]);
  });

  it('keeps a Promo in v-regular that only its suffix lifts there', () => {
    // svp-004 is there to exercise selectHolo's promo upgrade. Swap it for a
    // plain Holo Rare V and that path leaves the page, with every check above
    // still passing.
    const promos = (section('v-regular')?.cardIds ?? []).filter(
      (cardId) => CAPTURED_CARDS[cardId]?.rarity === 'Promo',
    );
    expect(promos).not.toEqual([]);
    for (const cardId of promos) {
      const card = CAPTURED_CARDS[cardId];
      expect(selectHolo(card).effect, cardId).toBe('v-regular');
      expect(selectHolo({ ...card, suffix: undefined }).effect, cardId).toBe('basic');
    }
  });
});

describe('selectedCard', () => {
  it('selects the card the route names, in the section it names', () => {
    for (const { entry, cardId } of cards) {
      const selected = selectedCard(entry.effect, cardId);
      expect([selected.entry.effect, selected.cardId]).toEqual([entry.effect, cardId]);
    }
  });

  it('opens a named section on its first card', () => {
    for (const entry of EFFECT_GALLERY) {
      const selected = selectedCard(entry.effect);
      expect([selected.entry.effect, selected.cardId]).toEqual([entry.effect, entry.cardIds[0]]);
    }
  });

  it('opens a section on its first card for a card that is not one of its three', () => {
    const [first, second] = EFFECT_GALLERY;
    expect(selectedCard(second.effect, 'not-a-card').cardId).toBe(second.cardIds[0]);
    // Another section's card included: it does not drag the selection there.
    const other = selectedCard(second.effect, first.cardIds[1]);
    expect([other.entry.effect, other.cardId]).toEqual([second.effect, second.cardIds[0]]);
  });

  it('otherwise opens the first section on its first card, whatever card is named', () => {
    const [first] = EFFECT_GALLERY;
    for (const cardId of [undefined, 'not-a-card', first.cardIds[1]]) {
      const selected = selectedCard(undefined, cardId);
      expect([selected.entry.effect, selected.cardId], String(cardId)).toEqual([
        first.effect,
        first.cardIds[0],
      ]);
    }
  });
});

describe('isSectionCard', () => {
  it('is true for exactly each section’s own three cards', () => {
    for (const entry of EFFECT_GALLERY) {
      const own = cardIds.filter((cardId) => isSectionCard(entry.effect, cardId));
      expect(own, entry.effect).toEqual([...entry.cardIds]);
    }
    expect(isSectionCard('basic', 'not-a-card')).toBe(false);
  });
});
