import { describe, expect, it } from 'vitest';
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

  it('treats anything other than the literal variant=reverse as the normal printing', () => {
    // No `variant` key at all — not `variant: undefined` — so a plain
    // `toEqual` on the plain route also proves the key is genuinely absent.
    expect(parseRoute('/card/swsh3-136?variant=bogus')).toEqual({
      view: 'card',
      cardId: 'swsh3-136',
    });
    expect(parseRoute('/card/swsh3-136')).toEqual({ view: 'card', cardId: 'swsh3-136' });
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

  it('changes when the view genuinely changes', () => {
    const keys = [
      viewKey(parseRoute('/')),
      viewKey(parseRoute('/search')),
      viewKey(parseRoute('/collection')),
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
