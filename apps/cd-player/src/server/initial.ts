import { createLogger } from '@ncam/logger';
import type { InitialData } from '../playback/engine';
import type { CollectionRef } from '../routes';
import { loadArtist, loadCollection, loadTrack } from '../spotify/embed';

const log = createLogger({ scope: 'cd-player' });

/**
 * What the server render shows before any client code runs: the collection, its first playable
 * track and that track's first artist (the backdrop and the lid's case). All of it inside a time
 * budget, since the host waits for this render; what misses the budget the client fetches again,
 * and is logged here. A complete answer is kept for ten minutes: the data is public and the same
 * for everyone. The host's server process outlives its requests, so at most 64 answers are kept,
 * the oldest first out.
 */
const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 64;
const cache = new Map<string, { at: number; data: InitialData }>();

/** The three fetches, named in the log when one of them misses. */
type Stage = 'collection' | 'track' | 'artist';

export interface InitialOptions {
  fetchImpl?: typeof fetch;
  budgetMs?: number;
  now?: () => number;
}

/**
 * The answer, or null when the request fails or `ms` pass first. The page then lacks that data, so
 * the miss is logged: once, even when a request that timed out fails afterwards.
 */
function within<T>(stage: Stage, key: string, promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: T | null, error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error !== undefined) log.warn('cd-player.ssr-data-failed', { stage, ref: key, error });
      resolve(value);
    };
    const timer = setTimeout(() => settle(null, 'timeout'), Math.max(0, ms));
    promise.then(
      (value) => settle(value),
      (error: unknown) => settle(null, String(error)),
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

/** Never rejects: a fetch that fails or misses the budget leaves its part of the answer null. */
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
  // One budget for the three fetches. Each gets what is left of it, as its own timeout too, so a
  // request the render stopped waiting for cannot outlive the budget; with nothing left the fetch
  // is skipped, since its answer could never be used.
  const stage = <T>(name: Stage, load: (timeoutMs: number) => Promise<T>): Promise<T | null> => {
    const ms = left();
    return ms > 0 ? within(name, key, load(Math.max(1, ms)), ms) : Promise.resolve(null);
  };
  const collection = await stage('collection', (ms) => loadCollection(ref, fetchImpl, ms));
  const first = collection?.tracks.find((track) => track.playable) ?? null;
  const firstTrack = first
    ? await stage('track', (ms) => loadTrack(first.id, fetchImpl, ms))
    : null;
  const artistId = firstTrack?.artists[0]?.id;
  const firstArtist = artistId
    ? await stage('artist', (ms) => loadArtist(artistId, fetchImpl, ms))
    : null;
  const data: InitialData = { ref, collection, firstTrack, firstArtist };
  if (collection && firstTrack) remember(key, now(), data);
  return data;
}

/** Tests only. */
export function clearInitialCache(): void {
  cache.clear();
}
