/**
 * The remote's own URLs, relative to its root (the host serves them below /projects/cd-player):
 * `/` (the visitor's last collection, else the default playlist), `/playlist/<id>` and
 * `/album/<id>`. Anything else renders like `/`.
 */
export type CollectionType = 'playlist' | 'album';

export interface CollectionRef {
  type: CollectionType;
  /** Spotify's 22-character base62 id. */
  id: string;
}

export type Route = { view: 'home' } | { view: 'collection'; ref: CollectionRef };

/** "Top 50 - Global": the page's own playlist until a visitor brings theirs. */
export const DEFAULT_COLLECTION: CollectionRef = { type: 'playlist', id: '37i9dQZEVXbMDoHDwVN2tF' };

export const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

const COLLECTION_PATH = /^\/(playlist|album)\/([A-Za-z0-9]{22})\/?$/;

export function parseRoute(route: string): Route {
  const path = route.split(/[?#]/, 1)[0] || '/';
  const match = COLLECTION_PATH.exec(path);
  if (!match) return { view: 'home' };
  return { view: 'collection', ref: { type: match[1] as CollectionType, id: match[2] } };
}

export function collectionPath(ref: CollectionRef): string {
  return `/${ref.type}/${ref.id}`;
}

/** The collection a route shows: its own, or the default playlist on `/`. */
export function routeCollection(route: Route): CollectionRef {
  return route.view === 'collection' ? route.ref : DEFAULT_COLLECTION;
}

export function sameCollection(a: CollectionRef | null, b: CollectionRef | null): boolean {
  return !!a && !!b && a.type === b.type && a.id === b.id;
}
