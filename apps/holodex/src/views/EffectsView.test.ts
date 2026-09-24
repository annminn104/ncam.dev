import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { EFFECT_GALLERY } from '../holo/effect-gallery';
import { CAPTURED_CARDS } from '../holo/effect-gallery.fixture';
import type { EffectId } from '../holo/select';
import { CARD_RARITIES } from '../lib/constants';
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

describe('EffectsView — tile markup', () => {
  it('puts no block-level element inside a tile button', () => {
    // A <button> takes phrasing content only. HoloCard's root and CardImage's
    // no-image placeholder, both inside a tile, used to be <div>s. Every card
    // is seeded, so each tile renders loaded: one live HoloCard, and plain art
    // (the placeholder: the fixture has no images) in the rest.
    const tiles = buttons(renderPage('reverse-holo', ALL_CARDS));
    expect(tiles).toHaveLength(EFFECT_GALLERY.length);
    for (const inner of tiles) {
      expect(inner).not.toMatch(/<(?:div|p|section|article|ul|ol|li|h[1-6]|table)\b/);
    }
  });

  it('keeps the art out of the tile name, which its caption already gives', () => {
    // The fixture is trimmed to what selectHolo reads, so it has no images:
    // give every card one to reach the <img> path, live tile included.
    const imaged = ALL_CARDS.map((card) => ({
      ...card,
      image: `https://assets.tcgdex.net/en/test/${card.id}`,
    }));
    const alts = [...renderPage('reverse-holo', imaged).matchAll(/<img\b[^>]*\balt="([^"]*)"/g)];
    expect(alts).toHaveLength(EFFECT_GALLERY.length);
    expect(alts.map(([, alt]) => alt).filter(Boolean)).toEqual([]);

    // And with no image: the placeholder that repeats the name is hidden too.
    const placeholders = [...renderPage('reverse-holo', ALL_CARDS).matchAll(/<span\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => tag.includes('aspect-ratio:63 / 88') && tag.includes('bg-holo-panel'));
    expect(placeholders).toHaveLength(EFFECT_GALLERY.length);
    expect(placeholders.filter((tag) => !tag.includes('aria-hidden="true"'))).toEqual([]);
  });
});
