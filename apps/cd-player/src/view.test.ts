import { describe, expect, it } from 'vitest';
import { initialSeq, step, type SeqEvent, type SeqState } from './playback/sequencer';
import type { ArtistDetail, Collection, Track, TrackDetail } from './spotify/types';
import {
  backdropFor,
  formatDuration,
  loaderLine,
  nowPlayingFor,
  sceneView,
  seekRange,
  trackView,
} from './view';

const collection: Collection = {
  type: 'playlist',
  id: 'p',
  name: 'Top 50 - Global',
  subtitle: 'Spotify',
  tracks: [
    {
      id: 'a',
      uri: 'spotify:track:a',
      title: 'A',
      artists: 'X',
      durationMs: 1000,
      playable: true,
      explicit: false,
    },
    {
      id: 'b',
      uri: 'spotify:track:b',
      title: 'B',
      artists: 'Y',
      durationMs: 2000,
      playable: true,
      explicit: false,
    },
  ],
};
const detailA: TrackDetail = {
  id: 'a',
  art: [{ url: 'art-a-640', width: 640 }],
  palette: { background: 'rgb(1, 2, 3)', tinted: 'rgb(0, 0, 0)', text: 'rgb(255, 255, 255)' },
  artists: [{ id: 'x', name: 'X' }],
};
const artistX: ArtistDetail = {
  id: 'x',
  name: 'X',
  images: [{ url: 'artist-x-640', width: 640 }],
  palette: null,
};
const source = (seq = step(initialSeq(), { type: 'LOAD', tracks: collection.tracks }).state) => ({
  collection,
  seq,
  details: new Map([['a', detailA]]),
  artists: new Map([['x', artistX]]),
});

describe('view model', () => {
  it('builds a track view from its detail and first artist, falling back to the album art', () => {
    const details = new Map([['a', detailA]]);
    expect(trackView(collection.tracks[0], details, new Map([['x', artistX]]))).toEqual({
      id: 'a',
      title: 'A',
      artists: 'X',
      artUrl: 'art-a-640',
      artistUrl: 'artist-x-640',
      palette: detailA.palette,
    });
    expect(trackView(collection.tracks[0], details, new Map()).artistUrl).toBe('art-a-640');
    expect(trackView(collection.tracks[1], details, new Map()).artUrl).toBeNull();
  });

  it('shows the first track as upcoming before anything plays', () => {
    const view = sceneView(source());
    expect(view.current).toBeNull();
    expect(view.upcoming.map((t) => t.id)).toEqual(['a', 'b']);
    expect(view).toMatchObject({
      trackNo: 0,
      total: 2,
      status: 'idle',
      collection: { name: 'Top 50 - Global' },
    });
    expect(backdropFor(source())).toEqual({ artUrl: 'art-a-640', palette: detailA.palette });
    expect(nowPlayingFor(source())).toBeNull();
  });

  it('names the playing track', () => {
    const seq = step(step(initialSeq(collection.tracks), { type: 'PLAY' }).state, {
      type: 'SWAP_DONE',
    }).state;
    expect(sceneView(source(seq))).toMatchObject({
      trackNo: 1,
      current: { id: 'a' },
      upcoming: [{ id: 'b' }],
    });
    expect(nowPlayingFor(source(seq))).toEqual({ title: 'A', artists: 'X', trackNo: 1, total: 2 });
  });

  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(208_810)).toBe('3:28');
    expect(formatDuration(3_600_000)).toBe('60:00');
  });

  it('counts the seek slider in the whole seconds the time shows', () => {
    // 1:23 of 3:28, the way formatDuration reads them (it floors).
    expect(seekRange(83_700, 208_810)).toEqual({ max: 208, value: 83 });
    expect(seekRange(0, 208_810)).toEqual({ max: 208, value: 0 });
  });

  it('keeps the slider inside its range', () => {
    // An update a moment past the end, a negative start, and a position before a duration is known.
    expect(seekRange(209_900, 208_810).value).toBe(208);
    expect(seekRange(-500, 208_810).value).toBe(0);
    expect(seekRange(5_000, 0)).toEqual({ max: 0, value: 0 });
  });
});

describe('loaderLine', () => {
  it("words the loader's line, with the download once its size is known", () => {
    expect(loaderLine(null)).toBe('Loading the player');
    expect(loaderLine(0)).toBe('Loading the player 0%');
    expect(loaderLine(0.63)).toBe('Loading the player 63%');
    expect(loaderLine(0.996)).toBe('Loading the player 100%');
    expect(loaderLine(1)).toBe('Loading the player 100%');
  });

  it('holds the count between 0 and 100, and drops one that is no number', () => {
    expect(loaderLine(1.4)).toBe('Loading the player 100%');
    expect(loaderLine(-0.2)).toBe('Loading the player 0%');
    expect(loaderLine(Number.NaN)).toBe('Loading the player');
  });
});

describe('the next five', () => {
  // c cannot play.
  const eight: Track[] = [...'abcdefgh'].map((id) => ({
    id,
    uri: `spotify:track:${id}`,
    title: id.toUpperCase(),
    artists: 'X',
    durationMs: 1000,
    playable: id !== 'c',
    explicit: false,
  }));
  const list: Collection = { ...collection, tracks: eight };
  const ids = (seq: SeqState) =>
    sceneView({ collection: list, seq, details: new Map(), artists: new Map() }).upcoming.map(
      ({ id }) => id,
    );
  const playing = (index: number, ...more: SeqEvent[]) => {
    const events: SeqEvent[] = [{ type: 'SELECT', index }, { type: 'SWAP_DONE' }, ...more];
    return events.reduce((seq, event) => step(seq, event).state, initialSeq(eight));
  };

  it('holds the next five playable tracks in play order, skipping one that cannot play', () => {
    expect(ids(initialSeq(eight))).toEqual(['a', 'b', 'd', 'e', 'f']);
    expect(ids(playing(0))).toEqual(['b', 'd', 'e', 'f', 'g']);
  });

  it('runs out at the end of the list, and wraps round it with Repeat', () => {
    expect(ids(playing(5))).toEqual(['g', 'h']);
    expect(ids(playing(5, { type: 'TOGGLE_REPEAT' }))).toEqual(['g', 'h', 'a', 'b', 'd']);
  });

  it('follows the shuffled play order under Shuffle', () => {
    // Seed 7 orders the eight as 0, 4, 6, 1, 2, 3, 5, 7 (a first, as it plays).
    expect(ids(playing(0, { type: 'TOGGLE_SHUFFLE', seed: 7 }))).toEqual(['e', 'g', 'b', 'd', 'f']);
  });
});
