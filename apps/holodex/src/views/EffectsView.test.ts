import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { EFFECT_GALLERY, ERA_QUALIFIER } from '../holo/effect-gallery';
import { CAPTURED_CARDS } from '../holo/effect-gallery.fixture';
import { MODERN_EFFECT_BY_RARITY, type EffectId } from '../holo/select';
import { CARD_RARITIES } from '../lib/constants';
import { cardImageBase } from '../lib/images';
import type { Card } from '../lib/tcgdex';
import { formatRoute } from '../routes';
import { EffectsView } from './EffectsView';
import { dataEffects, renderView } from './render-view.test-util';

// These render the page itself. effect-gallery.test.ts checks the data the
// page is built from; a page that dropped rarities or `reverse` on the way to
// the screen passed every one of those checks.

interface Selection {
  effect?: EffectId;
  card?: string;
}

function renderPage(selection: Selection = {}, cards: readonly Card[] = []): string {
  return renderView(
    createElement(EffectsView, selection),
    formatRoute({ view: 'effects', ...selection }),
    cards,
  );
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
};

const decode = (text: string) =>
  text.replace(/&(?:amp|lt|gt|quot|#x27);/g, (entity) => ENTITIES[entity]);

/** Every text node in the markup, decoded. A rarity chip renders its label as exactly one. */
function textNodes(html: string): string[] {
  return [...html.matchAll(/>([^<]+)</g)].map(([, text]) => decode(text));
}

interface Chip {
  rarity: string;
  /** Only on the chip of one arm of an era-split rarity. */
  era: string | undefined;
  text: string;
}

/** Every rarity chip in the markup: its `data-rarity`, its `data-era`, and its label. */
function chips(html: string): Chip[] {
  return [...html.matchAll(/<span\b([^>]*\bdata-rarity="[^"]*"[^>]*)>([^<]*)<\/span>/g)].map(
    ([, attrs, text]) => ({
      rarity: decode(/\bdata-rarity="([^"]*)"/.exec(attrs)?.[1] ?? ''),
      era: /\bdata-era="([^"]*)"/.exec(attrs)?.[1],
      text: decode(text),
    }),
  );
}

/** A chip as one string, so lists of them compare and sort. */
const chipKey = ({ rarity, era, text }: Chip) => `${rarity} | ${era ?? 'any era'} | ${text}`;

const CARD_IDS = new Set(EFFECT_GALLERY.flatMap((entry) => entry.cardIds));

interface Tile {
  attrs: string;
  inner: string;
  pressed: boolean;
  /** Loaded or not, a tile names its card id in a text node of its own. */
  cardId: string | undefined;
}

/** Every card tile in the markup: the <button>s with aria-pressed (none of them nest). */
function tiles(html: string): Tile[] {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .filter(([, attrs]) => attrs.includes('aria-pressed='))
    .map(([, attrs, inner]) => ({
      attrs,
      inner,
      pressed: attrs.includes('aria-pressed="true"'),
      cardId: textNodes(inner).find((text) => CARD_IDS.has(text)),
    }));
}

/** The card id of every tile marked pressed: the live card, and only it. */
const pressedCards = (html: string) => tiles(html).flatMap((t) => (t.pressed ? [t.cardId] : []));

/** Every <section> in the markup (none of them nest), in order. */
function sections(html: string) {
  return [...html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)].map(([, attrs, inner]) => ({
    id: /data-section="([^"]*)"/.exec(attrs)?.[1],
    headings: [...inner.matchAll(/<h2\b[^>]*>([^<]*)<\/h2>/g)].map(([, text]) => text),
    tiles: tiles(inner),
    chips: chips(inner),
  }));
}

const ALL_CARDS = Object.values(CAPTURED_CARDS);

/**
 * The same cards without the `image` the API links, to reach CardImage's
 * no-image placeholder. Not every tile gets there: the subset-set cards never
 * had an `image`, and cardImageBase recovers their art from the id.
 */
const UNLINKED_CARDS = ALL_CARDS.map((card) => ({ ...card, image: undefined }));
const PLACEHOLDER_COUNT = UNLINKED_CARDS.filter((card) => !cardImageBase(card)).length;

/** What a live tile says when its card has no art for the foil. */
const NO_ART_NOTE = 'TCGdex has no image for this card, so there is no art to foil.';

/** Every card the page can make live, with its section: all 87. */
const SELECTIONS = EFFECT_GALLERY.flatMap((entry) =>
  entry.cardIds.map((card) => [entry.effect, card] as const),
);

/** The page with every card loaded and `card` live, rendered once and shared below. */
const livePages = new Map<string, string>();
function livePage(effect: EffectId, card: string): string {
  const key = `${effect} ${card}`;
  const html = livePages.get(key) ?? renderPage({ effect, card }, ALL_CARDS);
  livePages.set(key, html);
  return html;
}

describe('EffectsView — one section per effect, three cards each', () => {
  it('renders every effect as a section, in order, headed by its id, holding its three cards', () => {
    // Loaded or not, so both with nothing in the cache and with every card.
    for (const html of [renderPage(), renderPage({}, ALL_CARDS)]) {
      const page = sections(html);
      expect(page.map((s) => s.id)).toEqual(EFFECT_GALLERY.map((entry) => entry.effect));
      expect(page.map((s) => s.headings)).toEqual(EFFECT_GALLERY.map((entry) => [entry.effect]));
      expect(page.map((s) => s.tiles.map((t) => t.cardId))).toEqual(
        EFFECT_GALLERY.map((entry) => [...entry.cardIds]),
      );
      // And no tile outside a section.
      expect(tiles(html)).toHaveLength(CARD_IDS.size);
    }
  });

  it('renders every (rarity, era arm) exactly once, qualifying only the era-split arms', () => {
    // Against the API's own list, not EFFECT_BY_RARITY: select.test.ts pins
    // the table to that list, and a table that lost an entry cannot shrink
    // this one along with it. A rarity the era splits (MODERN_EFFECT_BY_RARITY)
    // has a chip per arm, each saying which era it is true of, in the section
    // of the effect that arm selects; every other rarity has one chip, bare.
    const html = renderPage();
    const expected = CARD_RARITIES.flatMap((rarity): Chip[] =>
      Object.hasOwn(MODERN_EFFECT_BY_RARITY, rarity)
        ? (['modern', 'older'] as const).map((era) => ({
            rarity,
            era,
            text: `${rarity} · ${ERA_QUALIFIER[era]}`,
          }))
        : [{ rarity, era: undefined, text: rarity }],
    );
    expect(chips(html).map(chipKey).sort()).toEqual(expected.map(chipKey).sort());
    // The two arms of a split never read alike.
    expect(ERA_QUALIFIER.modern).not.toBe(ERA_QUALIFIER.older);
    // And every chip is in the section whose effect it selects.
    for (const section of sections(html)) {
      const entry = EFFECT_GALLERY.find((candidate) => candidate.effect === section.id);
      expect(
        section.chips.map(({ rarity, era }) => `${rarity} | ${era ?? 'any era'}`),
        section.id,
      ).toEqual(entry?.rarities.map(({ rarity, era }) => `${rarity} | ${era ?? 'any era'}`));
    }
  });
});

describe('EffectsView — exactly one live card on the whole page', () => {
  // Only the live tile mounts a HoloCard, whose root names the effect it
  // resolved to, so reading data-effect off the page counts every HoloCard on
  // it. Every card is seeded, so every tile renders loaded: any other tile
  // that rendered one would show up here too.

  it('makes the first card of the first section live at bare /effects', () => {
    const [first] = EFFECT_GALLERY;
    const html = renderPage({}, ALL_CARDS);
    expect(dataEffects(html)).toEqual([first.effect]);
    expect(pressedCards(html)).toEqual([first.cardIds[0]]);
  });

  it.each(EFFECT_GALLERY.map((entry) => [entry.effect, entry.cardIds[0]] as const))(
    'opens /effects/%s on its first card, %s',
    (effect, first) => {
      const html = renderPage({ effect }, ALL_CARDS);
      expect(dataEffects(html)).toEqual([effect]);
      expect(pressedCards(html)).toEqual([first]);
    },
  );

  it('covers all nine cards of the three reverse sections, the ones EffectsView must pass `variant` for', () => {
    // Without `variant`, their Commons and Uncommons render basic under a
    // reverse-holo, poke-ball-holo or masterball-holo heading.
    const reverseEffects: EffectId[] = ['reverse-holo', 'poke-ball-holo', 'masterball-holo'];
    expect(SELECTIONS.filter(([effect]) => reverseEffects.includes(effect))).toHaveLength(9);
  });

  it.each(SELECTIONS)('renders one HoloCard, resolving to %s, with %s live', (effect, card) => {
    const html = livePage(effect, card);
    expect(dataEffects(html)).toEqual([effect]);
    expect(pressedCards(html)).toEqual([card]);
  });
});

describe('EffectsView — every tile has the art of its card', () => {
  // The fixture is TCGdex's own copy: the API links an image for every card
  // but the subset-set ones, whose art cardImageBase recovers. Each card is
  // made live in turn, which covers both paths of every tile (plain
  // CardImage, and HoloCard) and the note a live tile shows when it has no art.
  it.each(SELECTIONS)('draws art on every tile, and no no-art note, with %s %s live', (e, card) => {
    const html = livePage(e, card);
    const all = tiles(html);
    expect(all).toHaveLength(CARD_IDS.size);
    expect(all.filter((t) => !/<img\b/.test(t.inner)).map((t) => t.cardId)).toEqual([]);
    expect(html).not.toContain(NO_ART_NOTE);
  });

  it('still shows the note, word for word, on a live tile whose card has no art', () => {
    // Keeps the check above honest: the note it looks for is really rendered.
    expect(renderPage({ effect: 'v-max' }, UNLINKED_CARDS)).toContain(NO_ART_NOTE);
  });
});

describe('EffectsView — basic’s note', () => {
  const BASIC_NOTE = 'basic draws no foil: HoloCard shows the plain art.';

  it('says why basic draws no foil in its section’s left column, whichever card is live', () => {
    // Loading or loaded, and with a basic card live or another section's.
    for (const html of [
      renderPage(),
      renderPage({}, ALL_CARDS),
      renderPage({ effect: 'basic' }, ALL_CARDS),
    ]) {
      const basic = /<section\b[^>]*data-section="basic"[^>]*>([\s\S]*?)<\/section>/.exec(
        html,
      )?.[1];
      const [left] = (basic ?? '').split('<ul');
      expect(textNodes(left)).toContain(BASIC_NOTE);
      // Once on the page: never under a tile as well.
      expect(html.split(BASIC_NOTE)).toHaveLength(2);
    }
  });
});

describe('EffectsView — loading, one tile at a time', () => {
  it('lets a card still loading cost its own tile, never its section or the live card', () => {
    const [first, second] = EFFECT_GALLERY;
    const slow = second.cardIds[1];
    const loaded = ALL_CARDS.filter((card) => card.id !== slow);
    const html = renderPage({}, loaded);
    const all = tiles(html);
    expect(all).toHaveLength(CARD_IDS.size);
    expect(all.filter((t) => !/<img\b/.test(t.inner)).map((t) => t.cardId)).toEqual([slow]);
    expect(dataEffects(html)).toEqual([first.effect]);

    // A live card still loading renders its skeleton, and no other card goes
    // live in its place.
    const waiting = renderPage({ effect: second.effect, card: slow }, loaded);
    expect(dataEffects(waiting)).toEqual([]);
    expect(pressedCards(waiting)).toEqual([slow]);
  });
});

describe('EffectsView — tile markup', () => {
  it('makes every tile a real toggle button, with nothing that switches off its focus ring', () => {
    // outline-none (or outline-hidden) beside FOCUS_RING's outline-2 leaves a
    // keyboard-focused tile with no ring at all: see the comment on FOCUS_RING.
    const all = tiles(renderPage({}, ALL_CARDS));
    expect(all).toHaveLength(CARD_IDS.size);
    for (const { attrs, cardId } of all) {
      expect(attrs, cardId).toContain('type="button"');
      expect(attrs, cardId).toMatch(/aria-pressed="(?:true|false)"/);
      expect(attrs, cardId).not.toMatch(/\boutline-(?:none|hidden)\b/);
    }
  });

  it('puts no block-level element inside a tile button', () => {
    // A <button> takes phrasing content only. HoloCard's root and CardImage's
    // no-image placeholder, both inside a tile, used to be <div>s. Every card
    // is seeded without its linked image, so each tile renders loaded: one
    // live HoloCard, and plain art in the rest (the placeholder, or the
    // recovered <img> on a subset-set card).
    const all = tiles(renderPage({ effect: 'reverse-holo' }, UNLINKED_CARDS));
    expect(all).toHaveLength(CARD_IDS.size);
    for (const { inner } of all) {
      expect(inner).not.toMatch(/<(?:div|p|section|article|ul|ol|li|h[1-6]|table)\b/);
    }
  });

  it('keeps the art out of the tile name, which its caption already gives', () => {
    // As served, every tile reaches the <img> path, live tile included.
    const alts = [
      ...renderPage({ effect: 'reverse-holo' }, ALL_CARDS).matchAll(/<img\b[^>]*\balt="([^"]*)"/g),
    ];
    expect(alts).toHaveLength(CARD_IDS.size);
    expect(alts.map(([, alt]) => alt).filter(Boolean)).toEqual([]);

    // And with no image: the placeholder that repeats the name is hidden too.
    const placeholders = [
      ...renderPage({ effect: 'reverse-holo' }, UNLINKED_CARDS).matchAll(/<span\b[^>]*>/g),
    ]
      .map(([tag]) => tag)
      .filter((tag) => tag.includes('aspect-ratio:63 / 88') && tag.includes('bg-holo-panel'));
    expect(PLACEHOLDER_COUNT).toBeGreaterThan(0);
    expect(placeholders).toHaveLength(PLACEHOLDER_COUNT);
    expect(placeholders.filter((tag) => !tag.includes('aria-hidden="true"'))).toEqual([]);
  });
});
