import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ARTIST, page, PLAYLIST, TRACK } from '../spotify/fixtures';
import { clearInitialCache, loadInitial } from './initial';

const REF = { type: 'playlist', id: PLAYLIST.id } as const;
const spotify = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('/embed/playlist/')) return new Response(page(PLAYLIST));
  if (url.includes('/embed/track/')) return new Response(page(TRACK));
  return new Response(page(ARTIST));
});

/** The line a miss logs; the fields after it say which fetch missed and why. */
const FAILED = expect.stringContaining('cd-player.ssr-data-failed');
const REF_KEY = `playlist:${PLAYLIST.id}`;

let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  // A miss is logged on purpose: keep that out of the test output, and look at it here.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  clearInitialCache();
  spotify.mockClear();
});

describe('loadInitial', () => {
  it('fetches the collection, its first playable track and that artist, then caches them', async () => {
    const data = await loadInitial(REF, { fetchImpl: spotify });
    expect(data.collection?.name).toBe('Top 50 - Global');
    expect(data.firstTrack?.id).toBe(TRACK.id);
    expect(data.firstArtist?.name).toBe('Tate McRae');
    await loadInitial(REF, { fetchImpl: spotify });
    expect(spotify).toHaveBeenCalledTimes(3);
  });

  it('returns what arrived inside the budget, and never caches a miss', async () => {
    const hang = vi.fn(() => new Promise<Response>(() => {}));
    const data = await loadInitial(REF, { fetchImpl: hang, budgetMs: 50 });
    expect(data).toEqual({ ref: REF, collection: null, firstTrack: null, firstArtist: null });
    await loadInitial(REF, { fetchImpl: spotify });
    expect(spotify).toHaveBeenCalled();
  });

  it('fetches again once its ten minutes are over', async () => {
    let clock = 0;
    const now = () => clock;
    await loadInitial(REF, { fetchImpl: spotify, now });
    clock = 9 * 60_000;
    await loadInitial(REF, { fetchImpl: spotify, now });
    expect(spotify).toHaveBeenCalledTimes(3);
    clock = 10 * 60_000;
    await loadInitial(REF, { fetchImpl: spotify, now });
    expect(spotify).toHaveBeenCalledTimes(6);
  });

  it('keeps at most 64 answers, dropping the oldest first', async () => {
    const refOf = (n: number) =>
      ({ type: 'playlist', id: `p${String(n).padStart(21, '0')}` }) as const;
    for (let n = 0; n < 65; n++) await loadInitial(refOf(n), { fetchImpl: spotify });
    spotify.mockClear();
    // The newest and the second oldest are still kept; only the first was dropped.
    await loadInitial(refOf(64), { fetchImpl: spotify });
    await loadInitial(refOf(1), { fetchImpl: spotify });
    expect(spotify).not.toHaveBeenCalled();
    await loadInitial(refOf(0), { fetchImpl: spotify });
    expect(spotify).toHaveBeenCalledTimes(3);
  });

  it('shares one budget: a later fetch that hangs leaves what arrived, uncached', async () => {
    const trackHangs = vi.fn((input: RequestInfo | URL) =>
      String(input).includes('/embed/playlist/')
        ? Promise.resolve(new Response(page(PLAYLIST)))
        : new Promise<Response>(() => {}),
    );
    const started = Date.now();
    const data = await loadInitial(REF, { fetchImpl: trackHangs, budgetMs: 50 });
    expect(Date.now() - started).toBeLessThan(500);
    expect(data.collection?.name).toBe('Top 50 - Global');
    expect(data.firstTrack).toBeNull();
    expect(data.firstArtist).toBeNull();
    expect(warn).toHaveBeenCalledWith(FAILED, { stage: 'track', ref: REF_KEY, error: 'timeout' });
    // A partial answer is never cached: the next call asks Spotify again.
    await loadInitial(REF, { fetchImpl: spotify });
    expect(spotify).toHaveBeenCalledTimes(3);
  });

  it('logs the fetch that failed, with its stage and why', async () => {
    const down = vi.fn(async () => new Response('', { status: 503 }));
    await loadInitial(REF, { fetchImpl: down });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(FAILED, {
      stage: 'collection',
      ref: REF_KEY,
      error: expect.stringContaining('status 503'),
    });

    warn.mockClear();
    const trackDown = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/embed/playlist/')
        ? new Response(page(PLAYLIST))
        : new Response('', { status: 503 }),
    );
    const data = await loadInitial(REF, { fetchImpl: trackDown });
    expect(data.collection?.name).toBe('Top 50 - Global');
    expect(data.firstTrack).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(FAILED, {
      stage: 'track',
      ref: REF_KEY,
      error: expect.stringContaining('status 503'),
    });
  });

  it('logs a fetch that misses the budget once, even when it fails afterwards', async () => {
    let fail: (reason: Error) => void = () => {};
    const late = vi.fn(
      () =>
        new Promise<Response>((_, reject) => {
          fail = reject;
        }),
    );
    await loadInitial(REF, { fetchImpl: late, budgetMs: 20 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(FAILED, {
      stage: 'collection',
      ref: REF_KEY,
      error: 'timeout',
    });
    fail(new Error('too late'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('skips the fetches that follow once the budget is spent', async () => {
    let clock = 0;
    const slow = vi.fn(async () => {
      clock += 201;
      return new Response(page(PLAYLIST));
    });
    const data = await loadInitial(REF, { fetchImpl: slow, budgetMs: 200, now: () => clock });
    expect(slow).toHaveBeenCalledTimes(1);
    expect(data.collection?.name).toBe('Top 50 - Global');
    expect(data.firstTrack).toBeNull();
    expect(data.firstArtist).toBeNull();
  });

  it('gives each fetch only what is left of the budget as its own timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      let clock = 0;
      const answer = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/embed/playlist/')) {
          clock += 120;
          return new Response(page(PLAYLIST));
        }
        return new Response(page(url.includes('/embed/track/') ? TRACK : ARTIST));
      });
      await loadInitial(REF, { fetchImpl: answer, budgetMs: 200, now: () => clock });
      expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([200, 80, 80]);
    } finally {
      timeout.mockRestore();
    }
  });
});
