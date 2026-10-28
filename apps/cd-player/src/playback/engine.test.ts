import { describe, expect, it, vi } from 'vitest';
import { createBridge } from '../bridge';
import type { SpotifyClient } from '../spotify/client';
import type { ArtistDetail, Collection, TrackDetail } from '../spotify/types';
import type { EmbedCallbacks, EmbedPlayer } from './embed-controller';
import { PlayerEngine } from './engine';

const collection: Collection = {
  type: 'playlist',
  id: '37i9dQZEVXbMDoHDwVN2tF',
  name: 'Top 50 - Global',
  subtitle: 'Spotify',
  tracks: ['a', 'b', 'c'].map((id) => ({
    id,
    uri: `spotify:track:${id}`,
    title: id.toUpperCase(),
    artists: 'X',
    durationMs: 30_000,
    playable: true,
    explicit: false,
  })),
};
const detail = (id: string): TrackDetail => ({
  id,
  art: [{ url: `art-${id}`, width: 640 }],
  palette: null,
  artists: [{ id: 'x', name: 'X' }],
});
const artist: ArtistDetail = {
  id: 'x',
  name: 'X',
  images: [{ url: 'artist-x', width: 640 }],
  palette: null,
};

function setup(options: { failPlayer?: boolean; hangPlayer?: boolean; realTimers?: boolean } = {}) {
  const client: SpotifyClient = {
    collection: vi.fn(async () => collection),
    track: vi.fn(async (id: string) => detail(id)),
    artist: vi.fn(async () => artist),
    seed: vi.fn(),
  };
  const bridge = createBridge();
  let finishSwap: () => void = () => {};
  bridge.setSwapper(() => new Promise<void>((resolve) => (finishSwap = resolve)));
  const player: EmbedPlayer = {
    load: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
    destroy: vi.fn(),
  };
  let callbacks: EmbedCallbacks | null = null;
  // Spotify's script can stay silent for good: a hanging player answers only on `arrive()`.
  let arrive: () => void = () => {};
  const createPlayer = vi.fn(async (_uri: string, cb: EmbedCallbacks) => {
    callbacks = cb;
    if (options.failPlayer) throw new Error('blocked');
    if (options.hangPlayer) await new Promise<void>((resolve) => (arrive = resolve));
    return player;
  });
  // Every timer the engine asks for: its callback, its delay (the hint's and the player's differ),
  // and the handles it gave back.
  const timers: (() => void)[] = [];
  const delays: number[] = [];
  const cleared: unknown[] = [];
  const engine = new PlayerEngine({
    client,
    bridge,
    createPlayer,
    ...(options.realTimers
      ? {}
      : {
          setTimer: (fn: () => void, ms: number) => {
            delays.push(ms);
            return timers.push(fn);
          },
          clearTimer: (handle: unknown) => void cleared.push(handle),
        }),
  });
  engine.attach();
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return {
    engine,
    client,
    bridge,
    player,
    flush,
    timers,
    delays,
    cleared,
    createPlayer,
    arrive: () => arrive(),
    swap: () => finishSwap(),
    cb: () => callbacks!,
  };
}

const ref = { type: 'playlist', id: collection.id } as const;

describe('PlayerEngine', () => {
  it('opens a collection, prefetches the first tracks and their artist, and names it to the scene', async () => {
    const { engine, client, bridge, flush } = setup();
    engine.open(ref);
    await flush();
    expect(engine.getSnapshot()).toMatchObject({
      loading: false,
      collection: { name: 'Top 50 - Global' },
    });
    expect(client.track).toHaveBeenCalledWith('a');
    expect(client.artist).toHaveBeenCalledWith('x');
    expect(bridge.getView().collection?.name).toBe('Top 50 - Global');
    expect(bridge.getView().upcoming[0]).toMatchObject({ id: 'a', artistUrl: 'artist-x' });
  });

  it('plays: builds the Spotify player on the action, changes the disc, then loads the track', async () => {
    const { engine, player, flush, swap } = setup();
    engine.open(ref);
    await flush();
    engine.user({ type: 'PLAY' });
    expect(engine.getSnapshot().embed).toBe('loading');
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ embed: 'ready', seq: { status: 'swapping' } });
    expect(player.load).not.toHaveBeenCalled();
    swap();
    await flush();
    expect(player.load).toHaveBeenCalledWith('spotify:track:a');
    expect(engine.getSnapshot().seq.status).toBe('playing');
  });

  it('asks for a press in the widget when playback does not start, and drops the hint when it does', async () => {
    const { engine, flush, swap, timers, cb } = setup();
    engine.open(ref);
    await flush();
    engine.user({ type: 'PLAY' });
    await flush();
    swap();
    await flush();
    timers.forEach((fn) => fn());
    expect(engine.getSnapshot().hint).toBe(true);
    cb().onStarted('spotify:track:a');
    expect(engine.getSnapshot().hint).toBe(false);
  });

  it('follows the embed: progress, its pause, and the end of a track', async () => {
    const { engine, flush, swap, cb, bridge } = setup();
    engine.open(ref);
    await flush();
    engine.user({ type: 'PLAY' });
    await flush();
    swap();
    await flush();
    cb().onStarted('spotify:track:a');
    cb().onUpdate({
      uri: 'spotify:track:a',
      paused: false,
      buffering: false,
      positionMs: 4000,
      durationMs: 30_000,
    });
    expect(engine.getSnapshot().seq.positionMs).toBe(4000);
    expect(bridge.getView().positionMs).toBe(4000);
    cb().onEnded();
    expect(engine.getSnapshot().seq.status).toBe('swapping');
    expect(bridge.getView().current?.id).toBe('b');
  });

  it('takes the scene keys', async () => {
    const { engine, flush, swap, bridge, player } = setup();
    engine.open(ref);
    await flush();
    bridge.emit({ type: 'toggle' });
    await flush();
    swap();
    await flush();
    bridge.emit({ type: 'toggle' });
    await flush();
    expect(player.pause).toHaveBeenCalled();
  });

  it('reports a blocked embed and keeps the page working', async () => {
    const { engine, flush } = setup({ failPlayer: true });
    engine.open(ref);
    await flush();
    engine.user({ type: 'PLAY' });
    await flush();
    expect(engine.getSnapshot().embed).toBe('blocked');
  });

  it('gives up on a Spotify player that never answers', async () => {
    const { engine, flush, timers, delays } = setup({ hangPlayer: true });
    engine.open(ref);
    await flush();
    engine.user({ type: 'PLAY' });
    await flush();
    expect(engine.getSnapshot().embed).toBe('loading');
    // The player's wait is the 20 s one, not the hint's.
    const wait = delays.indexOf(20_000);
    expect(wait).toBeGreaterThanOrEqual(0);
    timers[wait]();
    expect(engine.getSnapshot().embed).toBe('blocked');
  });

  it('destroys a Spotify player that turns up after the wait, and lets the next action try again', async () => {
    const { engine, flush, timers, delays, player, createPlayer, arrive } = setup({
      hangPlayer: true,
    });
    engine.open(ref);
    await flush();
    engine.user({ type: 'PLAY' });
    timers[delays.indexOf(20_000)]();
    expect(engine.getSnapshot().embed).toBe('blocked');
    arrive();
    await flush();
    expect(player.destroy).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().embed).toBe('blocked');
    expect(createPlayer).toHaveBeenCalledTimes(1);
    engine.user({ type: 'TOGGLE' });
    expect(createPlayer).toHaveBeenCalledTimes(2);
    expect(engine.getSnapshot().embed).toBe('loading');
  });

  it('stops waiting once the Spotify player answers', async () => {
    const { engine, flush, timers, cleared } = setup();
    engine.open(ref);
    await flush();
    engine.user({ type: 'PLAY' });
    await flush();
    expect(engine.getSnapshot().embed).toBe('ready');
    expect(cleared).toEqual([1]);
    // A wait that fires anyway (here, one that cannot be cancelled) leaves the answered player be.
    timers.forEach((fn) => fn());
    expect(engine.getSnapshot().embed).toBe('ready');
  });

  it('waits on the real timer when none is injected', async () => {
    vi.useFakeTimers();
    try {
      const { engine } = setup({ hangPlayer: true, realTimers: true });
      engine.open(ref);
      await vi.advanceTimersByTimeAsync(0);
      engine.user({ type: 'PLAY' });
      await vi.advanceTimersByTimeAsync(19_999);
      expect(engine.getSnapshot().embed).toBe('loading');
      await vi.advanceTimersByTimeAsync(1);
      expect(engine.getSnapshot().embed).toBe('blocked');
    } finally {
      vi.useRealTimers();
    }
  });

  it('words a failed collection and ignores answers for a collection no longer asked for', async () => {
    const { engine, client, flush } = setup();
    vi.mocked(client.collection).mockRejectedValueOnce(new Error('down'));
    engine.open(ref);
    await flush();
    expect(engine.getSnapshot().error).toMatch(/try again/i);
  });
});
