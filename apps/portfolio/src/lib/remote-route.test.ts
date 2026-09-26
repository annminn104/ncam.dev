import { describe, expect, it } from 'vitest';
import { fromRemoteRoute, toRemoteRoute } from './remote-route';

describe('toRemoteRoute', () => {
  it('returns "/" for the bare project route', () => {
    expect(toRemoteRoute(undefined, '')).toBe('/');
    expect(toRemoteRoute('', '')).toBe('/');
  });

  it('builds a leading-slash path from the splat', () => {
    expect(toRemoteRoute('sets/swsh3', '')).toBe('/sets/swsh3');
  });

  it('keeps a search string that already has its "?"', () => {
    expect(toRemoteRoute('sets/swsh3', '?type=Fire&page=2')).toBe('/sets/swsh3?type=Fire&page=2');
  });

  it('adds the "?" when the router hands over a bare query string', () => {
    expect(toRemoteRoute('search', 'q=pika')).toBe('/search?q=pika');
  });

  it('normalises stray slashes', () => {
    expect(toRemoteRoute('/card/swsh3-136/', '')).toBe('/card/swsh3-136');
  });
});

describe('fromRemoteRoute', () => {
  it('splits a path with no query', () => {
    expect(fromRemoteRoute('/sets/swsh3')).toEqual({ splat: 'sets/swsh3', search: {} });
  });

  it('splits a path with a query into router params', () => {
    expect(fromRemoteRoute('/search?q=pika&page=3')).toEqual({
      splat: 'search',
      search: { q: 'pika', page: '3' },
    });
  });

  it('maps the remote root onto an empty splat', () => {
    expect(fromRemoteRoute('/')).toEqual({ splat: '', search: {} });
  });

  it('round-trips with toRemoteRoute', () => {
    const original = '/sets/swsh3?type=Fire&page=2';
    const { splat, search } = fromRemoteRoute(original);
    const qs = new URLSearchParams(search).toString();
    expect(toRemoteRoute(splat, qs)).toBe(original);
  });
});
