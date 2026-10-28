import type { InitialData } from '../playback/engine';
import type { CollectionRef } from '../routes';
import { loadArtist, loadCollection, loadTrack } from '../spotify/embed';

/**
 * What the server render shows before any client code runs: the collection, its first playable
 * track and that track's first artist (the backdrop and the lid's case). All of it inside a time
 * budget, since the host waits for this render; what misses the budget the client fetches again.
 * A complete answer is kept for ten minutes: the data is public and the same for everyone. The
 * host's server process outlives its requests, so at most 64 answers are kept, the oldest first
 * out.
 */
const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 64;
const cache = new Map<string, { at: number; data: InitialData }>();

export interface InitialOptions {
  fetchImpl?: typeof fetch;
  budgetMs?: number;
  now?: () => number;
}

function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), Math.max(0, ms));
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/** A Map iterates in insertion order, so its first key is the oldest answer. */
function remember(key: string, at: number, data: InitialData): void {
  cache.delete(key);
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { at, data });
}

export async function loadInitial(
  ref: CollectionRef,
  options: InitialOptions = {},
): Promise<InitialData> {
  const { fetchImpl, budgetMs = 1500, now = Date.now } = options;
  const key = `${ref.type}:${ref.id}`;
  const hit = cache.get(key);
  if (hit) {
    if (now() - hit.at < TTL_MS) return hit.data;
    cache.delete(key);
  }
  const started = now();
  const left = () => budgetMs - (now() - started);
  const collection = await within(loadCollection(ref, fetchImpl, budgetMs), left());
  const first = collection?.tracks.find((track) => track.playable) ?? null;
  const firstTrack = first ? await within(loadTrack(first.id, fetchImpl, budgetMs), left()) : null;
  const artistId = firstTrack?.artists[0]?.id;
  const firstArtist = artistId
    ? await within(loadArtist(artistId, fetchImpl, budgetMs), left())
    : null;
  const data: InitialData = { ref, collection, firstTrack, firstArtist };
  if (collection && firstTrack) remember(key, now(), data);
  return data;
}

/** Tests only. */
export function clearInitialCache(): void {
  cache.clear();
}
