import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { EFFECT_GALLERY } from '../holo/effect-gallery';
import { CAPTURED_CARDS } from '../holo/effect-gallery.fixture';
import type { EffectId } from '../holo/select';
import { CARD_RARITIES } from '../lib/constants';
import { cardImageBase } from '../lib/images';
import type { Card } from '../lib/tcgdex';
import { EffectsView } from './EffectsView';
import { dataEffects, renderView } from './render-view.test-util';

// These render the page itself. effect-gallery.test.ts checks the data the
// page is built from; a page that dropped rarities or `reverse` on the way to
// the screen passed every one of those checks.

function renderPage(effect: EffectId | undefined, cards: readonly Card[] = []): string {
  return renderView(
    createElement(EffectsView, { effect }),
    effect ? `/effects/${effect}` : '/effects',
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

/** Every text node in the markup, decoded. A rarity chip renders its rarity as exactly one. */
function textNodes(html: string): string[] {
  return [...html.matchAll(/>([^<]+)</g)].map(([, text]) =>
    text.replace(/&(?:amp|lt|gt|quot|#x27);/g, (entity) => ENTITIES[entity]),
  );
}

/** The inside of every <button> in the markup (none of them nest). */
function buttons(html: string): string[] {
  return [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(([, inner]) => inner);
}

const ALL_CARDS = Object.values(CAPTURED_CARDS);

/**
 * The same cards without the `image` the API links, to reach CardImage's
 * no-image placeholder. Not every tile gets there: the five subset-set cards
 * never had an `image`, and cardImageBase recovers their art from the id.
 */
const UNLINKED_CARDS = ALL_CARDS.map((card) => ({ ...card, image: undefined }));
const PLACEHOLDER_COUNT = UNLINKED_CARDS.filter((card) => !cardImageBase(card)).length;

/** What a live tile says when its card has no art for the foil. */
const NO_ART_NOTE = 'TCGdex has no image for this card, so there is no art to foil.';

describe('EffectsView — every rarity, on the page', () => {
  it('renders every TCGdex rarity exactly once', () => {
    // Against the API's own list, not EFFECT_BY_RARITY: select.test.ts pins
    // the table to that list, and a table that lost an entry cannot shrink
    // this one along with it.
    const texts = textNodes(renderPage(undefined));
    const count = (rarity: string) => texts.filter((text) => text === rarity).length;
    expect(Object.fromEntries(CARD_RARITIES.map((rarity) => [rarity, count(rarity)]))).toEqual(
      Object.fromEntries(CARD_RARITIES.map((rarity) => [rarity, 1])),
    );
  });
});

describe('EffectsView — the live tile renders the effect it is labelled with', () => {
  // Only the selected tile mounts a HoloCard, whose root names the effect it
  // resolved to. The reverse-holo row is the one that needs EffectsView to
  // pass `reverse` through: without it, its Common card renders basic under
  // a reverse-holo label.
  const rows = EFFECT_GALLERY.flatMap((entry) =>
    entry.cardId === null ? [] : [[entry.effect, CAPTURED_CARDS[entry.cardId]] as const],
  );

  it('includes the reverse-holo tile', () => {
    expect(rows.map(([effect]) => effect)).toContain('reverse-holo');
  });

  it.each(rows)('renders the %s tile with that effect', (effect, card) => {
    expect(dataEffects(renderPage(effect, [card]))).toEqual([effect]);
  });
});

describe('EffectsView — every tile has the art of its card', () => {
  // The fixture is TCGdex's own copy: the API links an image for every card
  // but the five in subset sets, whose art cardImageBase recovers. Each tile
  // is rendered live in turn, which covers both of its paths (plain CardImage,
  // and HoloCard) and the note a live tile shows when it has no art.
  it.each(EFFECT_GALLERY.map((entry) => entry.effect))(
    'draws art on every tile, and no no-art note, with %s live',
    (effect) => {
      const html = renderPage(effect, ALL_CARDS);
      const tiles = buttons(html);
      expect(tiles).toHaveLength(EFFECT_GALLERY.length);
      const artless = EFFECT_GALLERY.filter((_, i) => !/<img\b/.test(tiles[i])).map(
        (entry) => entry.effect,
      );
      expect(artless).toEqual([]);
      expect(html).not.toContain(NO_ART_NOTE);
    },
  );

  it('still shows the note, word for word, on a live tile whose card has no art', () => {
    // Keeps the check above honest: the note it looks for is really rendered.
    expect(renderPage('v-max', UNLINKED_CARDS)).toContain(NO_ART_NOTE);
  });
});

describe('EffectsView — tile markup', () => {
  it('puts no block-level element inside a tile button', () => {
    // A <button> takes phrasing content only. HoloCard's root and CardImage's
    // no-image placeholder, both inside a tile, used to be <div>s. Every card
    // is seeded without its linked image, so each tile renders loaded: one
    // live HoloCard, and plain art in the rest (the placeholder, or the
    // recovered <img> on a subset-set card).
    const tiles = buttons(renderPage('reverse-holo', UNLINKED_CARDS));
    expect(tiles).toHaveLength(EFFECT_GALLERY.length);
    for (const inner of tiles) {
      expect(inner).not.toMatch(/<(?:div|p|section|article|ul|ol|li|h[1-6]|table)\b/);
    }
  });

  it('keeps the art out of the tile name, which its caption already gives', () => {
    // As served, every tile reaches the <img> path, live tile included.
    const alts = [...renderPage('reverse-holo', ALL_CARDS).matchAll(/<img\b[^>]*\balt="([^"]*)"/g)];
    expect(alts).toHaveLength(EFFECT_GALLERY.length);
    expect(alts.map(([, alt]) => alt).filter(Boolean)).toEqual([]);

    // And with no image: the placeholder that repeats the name is hidden too.
    const placeholders = [...renderPage('reverse-holo', UNLINKED_CARDS).matchAll(/<span\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => tag.includes('aspect-ratio:63 / 88') && tag.includes('bg-holo-panel'));
    expect(PLACEHOLDER_COUNT).toBeGreaterThan(0);
    expect(placeholders).toHaveLength(PLACEHOLDER_COUNT);
    expect(placeholders.filter((tag) => !tag.includes('aria-hidden="true"'))).toEqual([]);
  });
});
