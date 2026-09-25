import { describe, expect, it } from 'vitest';
import { EFFECT_GALLERY } from './holo/effect-gallery';
import { EMPTY_FILTERS, formatRoute, parseRoute, viewKey } from './routes';

describe('parseRoute', () => {
  it('maps the root onto home', () => {
    expect(parseRoute('/')).toEqual({ view: 'home' });
    expect(parseRoute('')).toEqual({ view: 'home' });
  });

  it('parses a set route with default filters', () => {
    expect(parseRoute('/sets/swsh3')).toEqual({
      view: 'set',
      setId: 'swsh3',
      filters: EMPTY_FILTERS,
    });
  });

  it('parses filters and a page off the query string', () => {
    expect(parseRoute('/sets/swsh3?q=char&type=Fire&rarity=Holo%20Rare&page=3')).toEqual({
      view: 'set',
      setId: 'swsh3',
      filters: { q: 'char', type: 'Fire', rarity: 'Holo Rare', page: 3 },
    });
  });

  it('falls back to page 1 for a nonsensical page', () => {
    expect(parseRoute('/search?page=abc')).toMatchObject({ filters: { page: 1 } });
    expect(parseRoute('/search?page=-4')).toMatchObject({ filters: { page: 1 } });
  });

  it('ignores unknown search params', () => {
    expect(parseRoute('/search?evil=1&q=pika')).toEqual({
      view: 'search',
      filters: { ...EMPTY_FILTERS, q: 'pika' },
    });
  });

  it('parses card and collection routes', () => {
    expect(parseRoute('/card/swsh3-136')).toEqual({ view: 'card', cardId: 'swsh3-136' });
    expect(parseRoute('/collection')).toEqual({ view: 'collection' });
  });

  it('parses ?variant=reverse on a card route', () => {
    expect(parseRoute('/card/swsh3-136?variant=reverse')).toEqual({
      view: 'card',
      cardId: 'swsh3-136',
      variant: 'reverse',
    });
  });

  it('parses ?variant=masterball on a card route', () => {
    expect(parseRoute('/card/sv08.5-001?variant=masterball')).toStrictEqual({
      view: 'card',
      cardId: 'sv08.5-001',
      variant: 'masterball',
    });
  });

  it('treats anything other than the literal variant=reverse as the normal printing', () => {
    // No `variant` key at all, not `variant: undefined`. That takes
    // `toStrictEqual`: plain `toEqual` ignores undefined properties, so it
    // would pass either way.
    expect(parseRoute('/card/swsh3-136?variant=bogus')).toStrictEqual({
      view: 'card',
      cardId: 'swsh3-136',
    });
    expect(parseRoute('/card/swsh3-136')).toStrictEqual({ view: 'card', cardId: 'swsh3-136' });
  });

  it('parses the effects page, a section on it, and a card in that section', () => {
    // No `effect` or `card` key at all where the URL names none — strictly,
    // as with `variant` above.
    const vMax = EFFECT_GALLERY.find((entry) => entry.effect === 'v-max');
    const card = vMax?.cardIds[1] ?? '';
    expect(parseRoute('/effects')).toStrictEqual({ view: 'effects' });
    expect(parseRoute('/effects/v-max')).toStrictEqual({ view: 'effects', effect: 'v-max' });
    expect(parseRoute(`/effects/v-max?card=${card}`)).toStrictEqual({
      view: 'effects',
      effect: 'v-max',
      card,
    });
  });

  it('opens the effects page on its defaults for an unknown effect or card, not a 404', () => {
    const [first, second] = EFFECT_GALLERY;
    expect(parseRoute('/effects/not-an-effect')).toStrictEqual({ view: 'effects' });
    expect(parseRoute(`/effects/not-an-effect?card=${first.cardIds[1]}`)).toStrictEqual({
      view: 'effects',
    });
    // A card the section does not show opens the section on its first card,
    // another section's card included.
    for (const card of ['not-a-card', first.cardIds[1], '']) {
      expect(parseRoute(`/effects/${second.effect}?card=${card}`), card).toStrictEqual({
        view: 'effects',
        effect: second.effect,
      });
    }
    // Without a section, a card names nothing.
    expect(parseRoute(`/effects?card=${first.cardIds[1]}`)).toStrictEqual({ view: 'effects' });
    expect(parseRoute('/effects/v-max/extra')).toEqual({
      view: 'not-found',
      path: '/effects/v-max/extra',
    });
  });

  it('decodes an escaped id segment', () => {
    expect(parseRoute('/card/exu-%21')).toEqual({ view: 'card', cardId: 'exu-!' });
  });

  it('tolerates a trailing slash', () => {
    expect(parseRoute('/sets/swsh3/')).toMatchObject({ view: 'set', setId: 'swsh3' });
  });

  it('returns not-found for anything else', () => {
    expect(parseRoute('/nope')).toEqual({ view: 'not-found', path: '/nope' });
    expect(parseRoute('/sets')).toEqual({ view: 'not-found', path: '/sets' });
    expect(parseRoute('/sets/swsh3/extra')).toEqual({
      view: 'not-found',
      path: '/sets/swsh3/extra',
    });
  });
});

describe('formatRoute', () => {
  it('formats every view', () => {
    expect(formatRoute({ view: 'home' })).toBe('/');
    expect(formatRoute({ view: 'collection' })).toBe('/collection');
    expect(formatRoute({ view: 'card', cardId: 'swsh3-136' })).toBe('/card/swsh3-136');
    expect(formatRoute({ view: 'set', setId: 'swsh3', filters: EMPTY_FILTERS })).toBe(
      '/sets/swsh3',
    );
  });

  it('omits empty filters and page 1', () => {
    expect(
      formatRoute({ view: 'search', filters: { q: 'pika', type: '', rarity: '', page: 1 } }),
    ).toBe('/search?q=pika');
  });

  it('round-trips a fully-loaded set route', () => {
    const input = '/sets/swsh3?q=char&type=Fire&rarity=Holo+Rare&page=3';
    expect(formatRoute(parseRoute(input))).toBe(input);
  });

  it('round-trips a card route with the reverse variant', () => {
    const input = '/card/swsh3-136?variant=reverse';
    expect(formatRoute(parseRoute(input))).toBe(input);
  });

  it('round-trips a card route with the Master Ball variant', () => {
    const input = '/card/sv08.5-001?variant=masterball';
    expect(formatRoute(parseRoute(input))).toBe(input);
  });

  it('round-trips the effects page, every section on it, and every card in each', () => {
    expect(formatRoute(parseRoute('/effects'))).toBe('/effects');
    for (const { effect, cardIds } of EFFECT_GALLERY) {
      expect(parseRoute(`/effects/${effect}`)).toStrictEqual({ view: 'effects', effect });
      expect(formatRoute(parseRoute(`/effects/${effect}`))).toBe(`/effects/${effect}`);
      for (const card of cardIds) {
        const url = `/effects/${effect}?card=${card}`;
        expect(parseRoute(url)).toStrictEqual({ view: 'effects', effect, card });
        expect(formatRoute(parseRoute(url))).toBe(url);
      }
    }
  });
});

describe('viewKey', () => {
  it('is stable while only the filters or the page change', () => {
    // The error boundary is keyed on this. If it changed here, the debounced
    // search box would be remounted on every commit and lose focus mid-word.
    const base = parseRoute('/sets/swsh3');
    expect(viewKey(parseRoute('/sets/swsh3?q=c'))).toBe(viewKey(base));
    expect(viewKey(parseRoute('/sets/swsh3?q=char&type=Fire&page=4'))).toBe(viewKey(base));
    expect(viewKey(parseRoute('/search?q=a'))).toBe(viewKey(parseRoute('/search?q=ab&page=2')));
  });

  it('is stable across the reverse-holo variant — toggling it must not remount the view', () => {
    // Keying more finely than `card:${cardId}` here is exactly the
    // remount/focus-loss bug the comment above documents; the variant must
    // stay as invisible to this key as filters and page are.
    expect(viewKey(parseRoute('/card/swsh3-136?variant=reverse'))).toBe(
      viewKey(parseRoute('/card/swsh3-136')),
    );
  });

  it('is constant across every section and card — picking one must not remount the view', () => {
    // Same bug as above if this keyed on either: the whole page would be
    // rebuilt on every pick and focus would drop off the card just clicked.
    const bare = viewKey(parseRoute('/effects'));
    for (const { effect, cardIds } of EFFECT_GALLERY) {
      expect(viewKey(parseRoute(`/effects/${effect}`)), effect).toBe(bare);
      for (const card of cardIds) {
        expect(viewKey(parseRoute(`/effects/${effect}?card=${card}`)), card).toBe(bare);
      }
    }
    expect(viewKey(parseRoute('/effects/not-an-effect?card=nope')), 'fallback').toBe(bare);
  });

  it('changes when the view genuinely changes', () => {
    const keys = [
      viewKey(parseRoute('/')),
      viewKey(parseRoute('/search')),
      viewKey(parseRoute('/collection')),
      viewKey(parseRoute('/effects')),
      viewKey(parseRoute('/sets/swsh3')),
      viewKey(parseRoute('/sets/swsh1')),
      viewKey(parseRoute('/card/swsh3-136')),
      viewKey(parseRoute('/card/swsh3-1')),
      viewKey(parseRoute('/nope')),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('separates two not-found paths so a fresh boundary is built for each', () => {
    expect(viewKey(parseRoute('/a/b'))).not.toBe(viewKey(parseRoute('/c/d')));
  });
});
