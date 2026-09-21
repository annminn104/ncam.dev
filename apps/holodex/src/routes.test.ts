import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, formatRoute, parseRoute } from './routes';

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
});
