import { describe, expect, it } from 'vitest';
import {
  collectionPath,
  DEFAULT_COLLECTION,
  parseRoute,
  routeCollection,
  sameCollection,
} from './routes';

const ID = '37i9dQZEVXbMDoHDwVN2tF';

describe('parseRoute', () => {
  it('reads playlist and album paths', () => {
    expect(parseRoute(`/playlist/${ID}`)).toEqual({
      view: 'collection',
      ref: { type: 'playlist', id: ID },
    });
    expect(parseRoute(`/album/${ID}/`)).toEqual({
      view: 'collection',
      ref: { type: 'album', id: ID },
    });
  });

  it('ignores the query string and the hash', () => {
    expect(parseRoute(`/playlist/${ID}?si=abc#top`)).toEqual({
      view: 'collection',
      ref: { type: 'playlist', id: ID },
    });
  });

  it('treats everything else as home', () => {
    for (const route of [
      '/',
      '',
      '/playlist',
      `/track/${ID}`,
      `/playlist/${ID}/more`,
      '/playlist/short',
    ]) {
      expect(parseRoute(route), route).toEqual({ view: 'home' });
    }
  });
});

describe('collection helpers', () => {
  it('builds the path that parses back to the same ref', () => {
    const ref = { type: 'album', id: ID } as const;
    expect(parseRoute(collectionPath(ref))).toEqual({ view: 'collection', ref });
  });

  it('falls back to the default playlist on home', () => {
    expect(routeCollection({ view: 'home' })).toEqual(DEFAULT_COLLECTION);
  });

  it('compares refs by type and id', () => {
    expect(sameCollection(DEFAULT_COLLECTION, { ...DEFAULT_COLLECTION })).toBe(true);
    expect(sameCollection(DEFAULT_COLLECTION, { type: 'album', id: DEFAULT_COLLECTION.id })).toBe(
      false,
    );
    expect(sameCollection(null, DEFAULT_COLLECTION)).toBe(false);
  });
});
