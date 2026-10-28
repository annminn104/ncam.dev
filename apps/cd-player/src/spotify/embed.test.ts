import { describe, expect, it, vi } from 'vitest';
import {
  EmbedError,
  embedUrl,
  fetchEntity,
  readEntity,
  toArtistDetail,
  toCollection,
  toTrackDetail,
} from './embed';
import { ARTIST, page, PLAYLIST, TRACK } from './fixtures';

const REF = { type: 'playlist', id: PLAYLIST.id } as const;

describe('readEntity', () => {
  it('extracts the entity, or null when the page has none', () => {
    expect(readEntity(page(PLAYLIST))).toEqual(PLAYLIST);
    expect(readEntity(page(undefined))).toBeNull();
  });

  it('fails as upstream without __NEXT_DATA__ or with broken JSON', () => {
    expect(() => readEntity('<html></html>')).toThrow(EmbedError);
    const broken = '<script id="__NEXT_DATA__" type="application/json">{nope</script>';
    expect(() => readEntity(broken)).toThrow(/not JSON/);
  });
});

describe('toCollection', () => {
  it('keeps tracks only and maps their fields', () => {
    const collection = toCollection(PLAYLIST, REF);
    expect(collection).toMatchObject({
      type: 'playlist',
      id: PLAYLIST.id,
      name: 'Top 50 - Global',
      subtitle: 'Spotify',
    });
    expect(collection.tracks).toEqual([
      {
        id: '2sFepQNyl1WjpROruP8bJ0',
        uri: 'spotify:track:2sFepQNyl1WjpROruP8bJ0',
        title: 'Housewife',
        artists: 'Tate McRae',
        durationMs: 208810,
        playable: true,
        explicit: false,
      },
      {
        id: '3h5T5JypYU7huFiVYhv1dr',
        uri: 'spotify:track:3h5T5JypYU7huFiVYhv1dr',
        title: 'BbY WOW',
        artists: 'KAROL G, Judeline, rusowsky',
        durationMs: 225834,
        playable: false,
        explicit: true,
      },
    ]);
  });

  it('skips list items that do not fit instead of failing the whole collection', () => {
    const [first, second, episode] = PLAYLIST.trackList;
    const noTitle = {
      uri: 'spotify:track:0000000000000000000001',
      subtitle: 'Nobody',
      duration: 1,
    };
    const messy = { ...PLAYLIST, trackList: [null, first, noTitle, second, episode] };
    const { tracks } = toCollection(messy, REF);
    expect(tracks.map((track) => track.title)).toEqual(['Housewife', 'BbY WOW']);
    expect(tracks).toEqual(toCollection(PLAYLIST, REF).tracks);
  });

  it('is an empty collection, not an error, for an empty list or one with only episodes', () => {
    const episode = PLAYLIST.trackList[2];
    expect(toCollection({ ...PLAYLIST, trackList: [] }, REF).tracks).toEqual([]);
    expect(toCollection({ ...PLAYLIST, trackList: [episode] }, REF).tracks).toEqual([]);
  });

  it('is not_found for a missing entity or another type', () => {
    expect(() => toCollection(null, REF)).toThrow(expect.objectContaining({ kind: 'not_found' }));
    expect(() => toCollection({ ...PLAYLIST, type: 'album' }, REF)).toThrow(
      expect.objectContaining({ kind: 'not_found' }),
    );
  });

  it('is upstream when the shape changed', () => {
    expect(() => toCollection({ ...PLAYLIST, trackList: undefined }, REF)).toThrow(
      expect.objectContaining({ kind: 'upstream' }),
    );
  });

  it('is upstream when no entry of a non-empty list is readable', () => {
    const noTitle = { uri: 'spotify:track:0000000000000000000001', subtitle: 'Nobody' };
    const unreadable = { ...PLAYLIST, trackList: [null, 'x', {}, noTitle] };
    expect(() => toCollection(unreadable, REF)).toThrow(
      expect.objectContaining({ kind: 'upstream' }),
    );
  });
});

describe('details', () => {
  it('maps a track: pictures by width, palette and artists', () => {
    expect(toTrackDetail(TRACK, TRACK.id)).toEqual({
      id: TRACK.id,
      art: [
        { url: 'https://image-cdn-ak.spotifycdn.com/image/64', width: 64 },
        { url: 'https://image-cdn-ak.spotifycdn.com/image/300', width: 300 },
        { url: 'https://image-cdn-ak.spotifycdn.com/image/640', width: 640 },
      ],
      palette: {
        background: 'rgb(152, 24, 32)',
        tinted: 'rgb(92, 0, 1)',
        text: 'rgb(255, 255, 255)',
      },
      artists: [{ id: '45dkTj5sMRSjrmBSBeiHym', name: 'Tate McRae' }],
    });
  });

  it('maps an artist, defaulting the tint and text colours', () => {
    expect(toArtistDetail(ARTIST, ARTIST.id)).toEqual({
      id: ARTIST.id,
      name: 'Tate McRae',
      images: [
        { url: 'https://image-cdn-fa.spotifycdn.com/image/320', width: 320 },
        { url: 'https://image-cdn-fa.spotifycdn.com/image/640', width: 640 },
      ],
      palette: {
        background: 'rgb(40, 87, 116)',
        tinted: 'rgb(40, 87, 116)',
        text: 'rgb(255, 255, 255)',
      },
    });
  });

  it('is not_found for a missing entity', () => {
    expect(() => toTrackDetail(null, 'x')).toThrow(expect.objectContaining({ kind: 'not_found' }));
    expect(() => toArtistDetail(null, 'x')).toThrow(expect.objectContaining({ kind: 'not_found' }));
  });
});

describe('fetchEntity', () => {
  const html = (body: string, status = 200) => new Response(body, { status });

  it('asks the embed page with a browser user agent and a timeout', async () => {
    const fetchImpl = vi.fn(async () => html(page(PLAYLIST)));
    await expect(fetchEntity('playlist', PLAYLIST.id, fetchImpl)).resolves.toEqual(PLAYLIST);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(embedUrl('playlist', PLAYLIST.id));
    expect(new Headers(init.headers).get('user-agent')).toMatch(/Mozilla/);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps 404 to not_found, other failures to upstream', async () => {
    await expect(fetchEntity('track', 'x', async () => html('', 404))).rejects.toMatchObject({
      kind: 'not_found',
    });
    await expect(fetchEntity('track', 'x', async () => html('', 503))).rejects.toMatchObject({
      kind: 'upstream',
    });
    await expect(
      fetchEntity('track', 'x', async () => {
        throw new TypeError('offline');
      }),
    ).rejects.toMatchObject({ kind: 'upstream' });
  });

  it('maps a body that fails while it is read to upstream', async () => {
    const failing = (reason: Error) => async () =>
      new Response(new ReadableStream({ start: (controller) => controller.error(reason) }));
    const cut = new TypeError('terminated');
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    for (const reason of [cut, timeout]) {
      await expect(fetchEntity('track', 'x', failing(reason))).rejects.toMatchObject({
        kind: 'upstream',
        message: expect.stringContaining(reason.message),
      });
    }
  });
});
