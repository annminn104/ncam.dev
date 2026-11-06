import { describe, expect, it } from 'vitest';
import type { ModelId } from './models';
import { initialSeq, step, type SeqEvent, type SeqState } from './playback/sequencer';
import type { ModelLoad } from './scene-props';
import type { ArtistDetail, Collection, Track, TrackDetail } from './spotify/types';
import {
  backdropFor,
  formatDuration,
  loaderLine,
  loaderPercent,
  nowPlayingFor,
  accentModelFor,
  pickerLoad,
  sameLoadPercent,
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
    expect(backdropFor(source())).toEqual({ artUrl: 'art-a-640' });
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

describe('loaderPercent', () => {
  it("rounds the GLB's download to the whole percent the loader shows", () => {
    expect(loaderPercent(null)).toBeNull();
    expect(loaderPercent(0)).toBe(0);
    expect(loaderPercent(0.63)).toBe(63);
    expect(loaderPercent(0.996)).toBe(100);
    expect(loaderPercent(1)).toBe(100);
  });

  it('holds the count between 0 and 100, and drops one that is no number', () => {
    expect(loaderPercent(1.4)).toBe(100);
    expect(loaderPercent(-0.2)).toBe(0);
    expect(loaderPercent(Number.NaN)).toBeNull();
  });

  it('gives every chunk inside one percent the same count, so the page renders once per percent', () => {
    expect(new Set([0.625, 0.6262, 0.63, 0.6349].map(loaderPercent))).toEqual(new Set([63]));
  });
});

describe('pickerLoad', () => {
  const reports: ModelLoad[] = [
    { model: 'clear', status: 'loading', fraction: 0.5 },
    { model: 'clear', status: 'ready' },
    { model: 'clear', status: 'failed' },
  ];

  it('keeps a report of the model the visitor last asked for', () => {
    for (const load of reports) expect(pickerLoad(load, 'clear')).toBe(load);
  });

  it('drops a report of the other model, so a change given up stays silent', () => {
    for (const load of reports) expect(pickerLoad(load, 'suitcase')).toBeNull();
  });

  it('has nothing to say before any report', () => {
    expect(pickerLoad(null, 'clear')).toBeNull();
  });
});

describe('sameLoadPercent', () => {
  const loading = (fraction: number | null, model: ModelId = 'clear'): ModelLoad => ({
    model,
    status: 'loading',
    fraction,
  });

  it("collapses a change's chunks within one whole percent, and only those", () => {
    expect(sameLoadPercent(loading(0.631), loading(0.634))).toBe(true);
    expect(sameLoadPercent(loading(0.634), loading(0.641))).toBe(false);
    expect(sameLoadPercent(loading(0.99), loading(1))).toBe(false);
  });

  it('keeps every report of a size still unknown as it comes, never as a percent', () => {
    expect(sameLoadPercent(loading(null), loading(null))).toBe(false);
    expect(sameLoadPercent(loading(null), loading(0))).toBe(false);
    expect(sameLoadPercent(loading(0), loading(null))).toBe(false);
  });

  it('never collapses the first report, another model, an end or a failure', () => {
    expect(sameLoadPercent(null, loading(0.5))).toBe(false);
    expect(sameLoadPercent(loading(0.5, 'suitcase'), loading(0.5))).toBe(false);
    expect(sameLoadPercent(loading(1), { model: 'clear', status: 'ready' })).toBe(false);
    const failed: ModelLoad = { model: 'clear', status: 'failed' };
    expect(sameLoadPercent(failed, failed)).toBe(false);
  });
});

describe('loaderLine', () => {
  it("words the loader's line, with the count once the GLB's size is known", () => {
    expect(loaderLine(null)).toBe('Loading the player');
    expect(loaderLine(0)).toBe('Loading the player 0%');
    expect(loaderLine(63)).toBe('Loading the player 63%');
    expect(loaderLine(100)).toBe('Loading the player 100%');
  });

  it('reads, through loaderPercent, as it did from the fraction itself', () => {
    const lines: [number | null, string][] = [
      [null, 'Loading the player'],
      [0, 'Loading the player 0%'],
      [0.63, 'Loading the player 63%'],
      [0.996, 'Loading the player 100%'],
      [1, 'Loading the player 100%'],
      [1.4, 'Loading the player 100%'],
      [-0.2, 'Loading the player 0%'],
      [Number.NaN, 'Loading the player'],
    ];
    for (const [fraction, line] of lines) {
      expect(loaderLine(loaderPercent(fraction)), String(fraction)).toBe(line);
    }
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

describe('accentModelFor', () => {
  it('follows the chosen model while the scene is not live', () => {
    expect(accentModelFor(false, 'suitcase', 'clear')).toBe('clear');
    expect(accentModelFor(false, null, 'suitcase')).toBe('suitcase');
  });

  it('follows the chosen model while live with nothing on show yet', () => {
    expect(accentModelFor(true, null, 'clear')).toBe('clear');
  });

  it('follows the model on show once live, whatever is chosen', () => {
    expect(accentModelFor(true, 'suitcase', 'clear')).toBe('suitcase');
    expect(accentModelFor(true, 'clear', 'suitcase')).toBe('clear');
  });
});
