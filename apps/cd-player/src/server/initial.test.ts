import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARTIST, page, PLAYLIST, TRACK } from '../spotify/fixtures';
import { clearInitialCache, loadInitial } from './initial';

const REF = { type: 'playlist', id: PLAYLIST.id } as const;
const spotify = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('/embed/playlist/')) return new Response(page(PLAYLIST));
  if (url.includes('/embed/track/')) return new Response(page(TRACK));
  return new Response(page(ARTIST));
});

afterEach(() => {
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
});
