import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ARTIST, notFoundPage, page, PLAYLIST, TRACK } from '../spotify/fixtures';
import { handleSpotify } from './spotify-handler';

const ask = (query: string, method = 'GET') =>
  new Request(`http://localhost/api/spotify?${query}`, { method });
const serving = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(page(body), { status }));

/** The line a 502 logs; the fields after it say which item failed and why. */
const UPSTREAM = expect.stringContaining('cd-player.upstream-failed');

let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  // A 502 is logged on purpose: keep that out of the test output, and look at it here.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

describe('handleSpotify', () => {
  it('serves a playlist with CORS and a short shared cache', async () => {
    const response = await handleSpotify(ask(`type=playlist&id=${PLAYLIST.id}`), serving(PLAYLIST));
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('cache-control')).toMatch(/s-maxage=3600/);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    const body = (await response.json()) as { name: string; tracks: unknown[] };
    expect(body.name).toBe('Top 50 - Global');
    expect(body.tracks).toHaveLength(2);
  });

  it('serves tracks and artists with a day-long cache', async () => {
    const track = await handleSpotify(ask(`type=track&id=${TRACK.id}`), serving(TRACK));
    expect(track.headers.get('cache-control')).toMatch(/s-maxage=86400/);
    expect(((await track.json()) as { artists: unknown[] }).artists).toHaveLength(1);
    const artist = await handleSpotify(ask(`type=artist&id=${ARTIST.id}`), serving(ARTIST));
    expect(((await artist.json()) as { name: string }).name).toBe('Tate McRae');
  });

  it('refuses bad types, ids and methods', async () => {
    const fetchImpl = vi.fn();
    expect(
      (await handleSpotify(ask('type=show&id=37i9dQZEVXbMDoHDwVN2tF'), fetchImpl)).status,
    ).toBe(400);
    expect((await handleSpotify(ask('type=playlist&id=nope'), fetchImpl)).status).toBe(400);
    expect((await handleSpotify(ask('type=playlist', 'POST'), fetchImpl)).status).toBe(405);
    expect((await handleSpotify(ask('', 'OPTIONS'), fetchImpl)).status).toBe(204);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown id and 502 when Spotify fails', async () => {
    const missing = await handleSpotify(
      ask(`type=playlist&id=${PLAYLIST.id}`),
      vi.fn(async () => new Response(notFoundPage())),
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
    const down = await handleSpotify(
      ask(`type=playlist&id=${PLAYLIST.id}`),
      serving(PLAYLIST, 503),
    );
    expect(down.status).toBe(502);
    expect(down.headers.get('cache-control')).toBe('no-store');
    const changed = await handleSpotify(
      ask(`type=playlist&id=${PLAYLIST.id}`),
      serving({ type: 'playlist' }),
    );
    expect(changed.status).toBe(502);
  });

  it('logs why it answered 502, with the item, and keeps the answer opaque', async () => {
    const ref = `playlist:${PLAYLIST.id}`;
    const down = await handleSpotify(
      ask(`type=playlist&id=${PLAYLIST.id}`),
      serving(PLAYLIST, 503),
    );
    expect(await down.json()).toEqual({ error: 'upstream' });
    expect(warn).toHaveBeenLastCalledWith(UPSTREAM, {
      ref,
      error: expect.stringContaining('status 503'),
    });
    // A layout change on Spotify's side names the shape that no longer fits.
    const changed = await handleSpotify(
      ask(`type=playlist&id=${PLAYLIST.id}`),
      serving({ type: 'playlist' }),
    );
    expect(await changed.json()).toEqual({ error: 'upstream' });
    expect(warn).toHaveBeenLastCalledWith(UPSTREAM, {
      ref,
      error: expect.stringContaining('unexpected shape'),
    });
    expect(warn).toHaveBeenCalledTimes(2);
    // A 404 is an answer, not a failure: nothing is logged.
    await handleSpotify(
      ask(`type=artist&id=${ARTIST.id}`),
      vi.fn(async () => new Response(notFoundPage())),
    );
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
