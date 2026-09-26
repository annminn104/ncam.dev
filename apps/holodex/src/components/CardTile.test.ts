import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardTile } from './CardTile';

// Every grid (set pages, search, the collection) draws a card brief through
// CardTile, and the brief of a subset-set card never carries an image.
// Rendered as markup under node, like the views: no DOM needed.
describe('CardTile', () => {
  it('draws a subset-set card from its parent set, which TCGdex does not link', () => {
    const html = renderToString(
      createElement(CardTile, {
        card: { id: 'swsh12tg-TG23', localId: 'TG23', name: 'Friends in Galar' },
        onOpen: () => undefined,
      }),
    );
    expect(html).toContain('src="https://assets.tcgdex.net/en/swsh/swsh12/TG23/low.webp"');
  });
});
