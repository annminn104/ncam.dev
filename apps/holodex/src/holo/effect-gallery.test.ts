import { describe, expect, it } from 'vitest';
import { cardImageBase } from '../lib/images';
import { EFFECT_GALLERY, selectedExample, type EffectExample } from './effect-gallery';
import { CAPTURED_CARDS } from './effect-gallery.fixture';
import { EFFECT_BY_RARITY, OVERRIDE_ONLY_EFFECTS, selectHolo, type EffectId } from './select';

// Derived the way effects/index.test.ts derives it — from the rarity table and
// the override list, never typed out — so a newly selectable effect joins this
// set on its own, and the page fails here until it grows a tile for it.
const ALL_EFFECT_IDS: EffectId[] = [
  ...new Set([...Object.values(EFFECT_BY_RARITY), ...OVERRIDE_ONLY_EFFECTS]),
];

const effects = EFFECT_GALLERY.map((entry) => entry.effect);
const cardIds = EFFECT_GALLERY.flatMap((entry) => (entry.cardId === null ? [] : [entry.cardId]));
const repeated = (values: string[]) => values.filter((value, i) => values.indexOf(value) !== i);

describe('EFFECT_GALLERY — one tile per effect', () => {
  it('covers every effect selectHolo can return, each exactly once', () => {
    expect([...effects].sort()).toEqual([...ALL_EFFECT_IDS].sort());
  });

  it('never repeats an effect or a card', () => {
    expect(repeated(effects)).toEqual([]);
    expect(repeated(cardIds)).toEqual([]);
  });

  it('keeps the two Venusaur ex side by side, so the page shows they no longer look alike', () => {
    const doubleRare = EFFECT_GALLERY.findIndex((entry) => entry.cardId === 'sv03.5-003');
    const ultraRare = EFFECT_GALLERY.findIndex((entry) => entry.cardId === 'sv03.5-182');
    expect(doubleRare).toBeGreaterThanOrEqual(0);
    expect(ultraRare).toBeGreaterThanOrEqual(0);
    expect(Math.abs(ultraRare - doubleRare)).toBe(1);
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

  it('lists every rarity in the table under exactly one tile', () => {
    // The data only: a rarity missing here, or listed twice, is a tile that
    // lies about what selects it. This passes whatever the page does with the
    // list; views/EffectsView.test.ts checks what the page actually renders.
    const shown = EFFECT_GALLERY.flatMap((entry) => entry.rarities);
    expect([...shown].sort()).toEqual(Object.keys(EFFECT_BY_RARITY).sort());
  });

  it('labels exactly the override-only effects as override-driven, so no tile lists nothing', () => {
    const labelled = EFFECT_GALLERY.filter((entry) => entry.override).map((entry) => entry.effect);
    expect([...labelled].sort()).toEqual([...OVERRIDE_ONLY_EFFECTS].sort());
    for (const entry of EFFECT_GALLERY) {
      expect(entry.rarities.length > 0 || Boolean(entry.override), entry.effect).toBe(true);
    }
  });
});

describe('EFFECT_GALLERY — a real card for every effect', () => {
  it('has a card for every effect today', () => {
    // An effect silently losing its only example must fail here, not render
    // an empty tile.
    expect(EFFECT_GALLERY.filter((entry) => entry.cardId === null).map((e) => e.effect)).toEqual(
      [],
    );
  });

  it('explains any effect that has lost its card', () => {
    const unexplained = EFFECT_GALLERY.filter((entry) => entry.cardId === null && !entry.note);
    expect(unexplained.map((entry) => entry.effect)).toEqual([]);
  });

  it('has art for every tile: the image TCGdex links, or the one cardImageBase recovers', () => {
    // None without art, and listed by effect rather than counted, so the one
    // tile that loses its art (a card swapped in with none, or a subset set
    // the rule stops reaching) fails here by name. The five subset-set cards
    // have no `image` in the fixture because TCGdex serves them with none.
    const artless = EFFECT_GALLERY.filter((entry) => {
      const card = entry.cardId === null ? undefined : CAPTURED_CARDS[entry.cardId];
      return !card || !cardImageBase(card);
    }).map((entry) => entry.effect);
    expect(artless).toEqual([]);
  });

  it('holds a captured TCGdex copy of exactly the cards it shows', () => {
    // Without one, the check below would have nothing to run selectHolo on.
    expect(Object.keys(CAPTURED_CARDS).sort()).toEqual([...cardIds].sort());
  });

  it('points every tile at a card the real selectHolo really gives that effect', () => {
    // The check the table itself can't make: an earlier draft of this list
    // named a card that selected something else. `reverse` is passed as each
    // entry declares it. Whether EffectsView really hands it on to HoloCard
    // is only visible on the rendered page: views/EffectsView.test.ts.
    for (const entry of EFFECT_GALLERY) {
      if (entry.cardId === null) continue;
      const card = CAPTURED_CARDS[entry.cardId];
      expect(card?.id, entry.effect).toBe(entry.cardId);
      expect(selectHolo(card, { reverse: entry.reverse }).effect, entry.cardId).toBe(entry.effect);
    }
  });

  it('shows a reverse printing only for reverse-holo, and only of a card that has one', () => {
    const reversed = EFFECT_GALLERY.filter((entry) => entry.reverse);
    expect(reversed.map((entry) => entry.effect)).toEqual(['reverse-holo']);
    for (const entry of reversed) {
      expect(CAPTURED_CARDS[entry.cardId ?? '']?.variants?.reverse, entry.effect).toBe(true);
    }
  });
});

describe('selectedExample', () => {
  it('selects the tile the route names', () => {
    expect(selectedExample('v-max').effect).toBe('v-max');
    expect(selectedExample('reverse-holo').effect).toBe('reverse-holo');
  });

  it('otherwise defaults to the first entry that has a card', () => {
    const gallery: EffectExample[] = [
      { effect: 'basic', rarities: ['Common'], cardId: null, note: 'No card left.' },
      { effect: 'regular-holo', rarities: ['Holo Rare'], cardId: 'swsh3-25' },
      { effect: 'v-max', rarities: ['Holo Rare VMAX'], cardId: 'swsh3-2' },
    ];
    expect(selectedExample(undefined, gallery).effect).toBe('regular-holo');
    // An effect with no tile in this gallery gets the same default.
    expect(selectedExample('cosmos-holo', gallery).effect).toBe('regular-holo');
  });
});
