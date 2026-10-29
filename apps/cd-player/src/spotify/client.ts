import type { CollectionRef, CollectionType } from '../routes';
import { SPOTIFY_ROUTE } from './api-route';
import type { ArtistDetail, Collection, TrackDetail } from './types';

export type RequestErrorCode = 'bad_request' | 'not_found' | 'upstream' | 'network';
type ItemType = 'playlist' | 'album' | 'track' | 'artist';

export class SpotifyRequestError extends Error {
  constructor(
    readonly code: RequestErrorCode,
    readonly status: number,
  ) {
    super(`spotify ${code} (${status})`);
    this.name = 'SpotifyRequestError';
  }
}

export interface SpotifyClient {
  collection(ref: CollectionRef): Promise<Collection>;
  track(id: string): Promise<TrackDetail>;
  artist(id: string): Promise<ArtistDetail>;
  /** Primes the cache with what the server render already fetched. */
  seed(type: ItemType, id: string, value: unknown): void;
}

/**
 * The proxy's client. `base` is this remote's own base URL (lib/asset-url remoteBase): mounted in
 * the host, the page is on another origin, and the proxy lives at the root of the remote's. One
 * request per item at a time; answers are kept for the page's life, failures are not.
 */
export function createSpotifyClient(
  base: string,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): SpotifyClient {
  const cache = new Map<string, Promise<unknown>>();

  async function request(type: ItemType, id: string): Promise<unknown> {
    const url = new URL(SPOTIFY_ROUTE, base || 'http://localhost/');
    url.searchParams.set('type', type);
    url.searchParams.set('id', id);
    let response: Response;
    try {
      response = await fetchImpl(url.href);
    } catch {
      throw new SpotifyRequestError('network', 0);
    }
    if (!response.ok) {
      const code: RequestErrorCode =
        response.status === 400
          ? 'bad_request'
          : response.status === 404
            ? 'not_found'
            : 'upstream';
      throw new SpotifyRequestError(code, response.status);
    }
    return response.json();
  }

  function get<T>(type: ItemType, id: string): Promise<T> {
    const key = `${type}:${id}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = request(type, id).catch((error: unknown) => {
        cache.delete(key);
        throw error;
      });
      cache.set(key, pending);
    }
    return pending as Promise<T>;
  }

  return {
    collection: (ref) => get<Collection>(ref.type, ref.id),
    track: (id) => get<TrackDetail>('track', id),
    artist: (id) => get<ArtistDetail>('artist', id),
    seed: (type, id, value) => {
      cache.set(`${type}:${id}`, Promise.resolve(value));
    },
  };
}

/** What the visitor reads when the collection `type` was asked for and `error` came back. */
export function requestErrorMessage(error: unknown, type: CollectionType): string {
  if (error instanceof SpotifyRequestError && error.code === 'not_found') {
    return `We couldn't open that ${type}. It may be private or deleted.`;
  }
  return "Spotify didn't answer. Try again in a moment.";
}
