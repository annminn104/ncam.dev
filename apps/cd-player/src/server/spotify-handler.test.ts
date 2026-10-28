import { describe, expect, it, vi } from 'vitest';
import { ARTIST, notFoundPage, page, PLAYLIST, TRACK } from '../spotify/fixtures';
import { handleSpotify } from './spotify-handler';

const ask = (query: string, method = 'GET') =>
  new Request(`http://localhost/api/spotify?${query}`, { method });
const serving = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(page(body), { status }));

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
});
