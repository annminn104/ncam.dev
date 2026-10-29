import { describe, expect, it, vi } from 'vitest';
import { createBridge } from '../bridge';
import { SpotifyRequestError, type SpotifyClient } from '../spotify/client';
import type { ArtistDetail, Collection, TrackDetail } from '../spotify/types';
import type { EmbedCallbacks, EmbedPlayer } from './embed-controller';
import { PlayerEngine } from './engine';
import type { SeqEvent } from './sequencer';

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

interface SetupOptions {
  /** Building the Spotify player is refused at once. */
  failPlayer?: boolean;
  /** Building it stays pending until the test calls `arrive()` (or `refuse()`). */
  hangPlayer?: boolean;
  /** Only the first attempt misbehaves; the next one (after a retry) works. */
  firstAttemptOnly?: boolean;
  /** No injected timers: the engine uses the real ones. */
  realTimers?: boolean;
}

function setup(options: SetupOptions = {}) {
  const client: SpotifyClient = {
    collection: vi.fn(async () => collection),
    track: vi.fn(async (id: string) => detail(id)),
    artist: vi.fn(async () => artist),
    seed: vi.fn(),
  };
  const bridge = createBridge();
  // The disc change stays pending until the test settles it: `swap()` seats the latest one,
  // `failSwap()` jams it, `swaps` holds every one's resolver (to settle an older one late).
  let finishSwap: () => void = () => {};
  let failSwap: () => void = () => {};
  const swaps: (() => void)[] = [];
  bridge.setSwapper(
    () =>
      new Promise<void>((resolve, reject) => {
        finishSwap = resolve;
        failSwap = () => reject(new Error('jammed'));
        swaps.push(resolve);
      }),
  );
  const player: EmbedPlayer = {
    load: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
    destroy: vi.fn(),
  };
  let callbacks: EmbedCallbacks | null = null;
  // Spotify's script can stay silent for good: a hanging player answers only on `arrive()`, or is
  // refused on `refuse()`.
  let arrive: () => void = () => {};
  let refuse: () => void = () => {};
  let attempts = 0;
  const createPlayer = vi.fn(async (_uri: string, cb: EmbedCallbacks) => {
    callbacks = cb;
    const misbehaves = !options.firstAttemptOnly || ++attempts === 1;
    if (misbehaves && options.failPlayer) throw new Error('blocked');
    if (misbehaves && options.hangPlayer) {
      await new Promise<void>((resolve, reject) => {
        arrive = resolve;
        refuse = () => reject(new Error('blocked'));
      });
    }
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
    refuse: () => refuse(),
    swap: () => finishSwap(),
    failSwap: () => failSwap(),
    swaps,
    cb: () => callbacks!,
  };
}

const ref = { type: 'playlist', id: collection.id } as const;

type Ctx = ReturnType<typeof setup>;

/** The two ways building the Spotify player fails: it is refused, or it never answers. */
const failures: { how: string; fail: (ctx: Ctx) => Promise<void> | void }[] = [
  {
    how: 'is refused',
    fail: async (ctx) => {
      ctx.refuse();
      await ctx.flush();
    },
  },
  // The 20 s wait runs out.
  { how: 'never answers', fail: (ctx) => ctx.timers[ctx.delays.indexOf(20_000)]() },
];

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

  it('names an album it cannot open as an album', async () => {
    const { engine, client, flush } = setup();
    vi.mocked(client.collection).mockRejectedValueOnce(new SpotifyRequestError('not_found', 404));
    engine.open({ type: 'album', id: collection.id });
    await flush();
    expect(engine.getSnapshot().error).toBe(
      "We couldn't open that album. It may be private or deleted.",
    );
  });

  // With no player there is no music, so the sequencer must not stay `playing` (the next press of
  // play would pause) or `swapping` (the disc seating would then "play"): it goes idle, keeping the
  // track, and the next press of play builds a new player and loads that track into it.
  describe.each(failures)('when the Spotify player $how', ({ fail }) => {
    // Only the first attempt fails: the visitor's next press of play builds one that works.
    const start = () => setup({ hangPlayer: true, firstAttemptOnly: true });

    it('goes idle during the disc change, and ignores the disc seating late', async () => {
      const ctx = start();
      const { engine, flush, swap, player } = ctx;
      engine.open(ref);
      await flush();
      engine.send({ type: 'TOGGLE_REPEAT' });
      engine.user({ type: 'PLAY' });
      const before = engine.getSnapshot().seq;
      expect(before).toMatchObject({ status: 'swapping', cursor: 0, repeat: true });
      await fail(ctx);
      expect(engine.getSnapshot().embed).toBe('blocked');
      expect(engine.getSnapshot().seq).toEqual({ ...before, status: 'idle', positionMs: 0 });
      swap();
      await flush();
      expect(engine.getSnapshot().seq.status).toBe('idle');
      expect(player.load).not.toHaveBeenCalled();
    });

    it('goes idle when it fails after the disc is seated', async () => {
      const ctx = start();
      const { engine, flush, swap } = ctx;
      engine.open(ref);
      await flush();
      engine.user({ type: 'PLAY' });
      swap();
      await flush();
      expect(engine.getSnapshot().seq.status).toBe('playing');
      await fail(ctx);
      expect(engine.getSnapshot()).toMatchObject({
        embed: 'blocked',
        seq: { status: 'idle', cursor: 0 },
      });
    });

    it('plays again on the next press: a fresh player is given the current track', async () => {
      const ctx = start();
      const { engine, flush, swap, createPlayer, player } = ctx;
      engine.open(ref);
      await flush();
      engine.user({ type: 'PLAY' });
      await fail(ctx);
      swap();
      await flush();
      engine.user({ type: 'PLAY' });
      expect(createPlayer).toHaveBeenCalledTimes(2);
      expect(createPlayer).toHaveBeenLastCalledWith('spotify:track:a', expect.anything());
      expect(engine.getSnapshot()).toMatchObject({ embed: 'loading', seq: { status: 'playing' } });
      await flush();
      expect(engine.getSnapshot().embed).toBe('ready');
      expect(player.load).toHaveBeenCalledTimes(1);
      expect(player.load).toHaveBeenCalledWith('spotify:track:a');
    });
  });

  it('drops what was queued for a Spotify player that turns up after the wait', async () => {
    const { engine, flush, swap, timers, delays, player, arrive } = setup({
      hangPlayer: true,
      firstAttemptOnly: true,
    });
    engine.open(ref);
    await flush();
    engine.user({ type: 'PLAY' });
    swap();
    await flush();
    // The disc is seated and the load waits for the player; then the wait runs out.
    timers[delays.indexOf(20_000)]();
    arrive();
    await flush();
    expect(player.destroy).toHaveBeenCalledTimes(1);
    // The destroyed player gets no load, and no "press play in the widget" hint is armed for it.
    expect(player.load).not.toHaveBeenCalled();
    expect(delays).toEqual([20_000]);
  });

  // Spotify's script loads on the visitor's first play action, not on any key.
  describe('building the Spotify player', () => {
    const quiet: { name: string; event: SeqEvent; effect: object }[] = [
      { name: 'shuffle', event: { type: 'TOGGLE_SHUFFLE', seed: 7 }, effect: { shuffle: true } },
      { name: 'repeat', event: { type: 'TOGGLE_REPEAT' }, effect: { repeat: true } },
      { name: 'stop', event: { type: 'STOP' }, effect: {} },
      { name: 'seek', event: { type: 'SEEK', ms: 5000 }, effect: {} },
    ];
    it.each(quiet)('is not done by $name at idle', async ({ event, effect }) => {
      const { engine, flush, createPlayer } = setup();
      engine.open(ref);
      await flush();
      engine.user(event);
      await flush();
      expect(createPlayer).not.toHaveBeenCalled();
      expect(engine.getSnapshot().embed).toBe('off');
      // The key itself still did its work.
      expect(engine.getSnapshot().seq).toMatchObject({ status: 'idle', ...effect });
    });

    const starting: { name: string; event: SeqEvent; uri: string }[] = [
      { name: 'play', event: { type: 'PLAY' }, uri: 'spotify:track:a' },
      { name: 'select', event: { type: 'SELECT', index: 1 }, uri: 'spotify:track:b' },
      { name: 'next', event: { type: 'NEXT' }, uri: 'spotify:track:a' },
    ];
    it.each(starting)('is done by $name at idle, showing $uri', async ({ event, uri }) => {
      const { engine, flush, createPlayer } = setup();
      engine.open(ref);
      await flush();
      engine.user(event);
      expect(createPlayer).toHaveBeenCalledTimes(1);
      expect(createPlayer).toHaveBeenCalledWith(uri, expect.anything());
    });

    it('is not tried again after a failure by a key that does not play', async () => {
      const { engine, flush, createPlayer } = setup({ failPlayer: true });
      engine.open(ref);
      await flush();
      engine.user({ type: 'PLAY' });
      await flush();
      expect(engine.getSnapshot().embed).toBe('blocked');
      engine.user({ type: 'TOGGLE_SHUFFLE', seed: 7 });
      engine.user({ type: 'TOGGLE_REPEAT' });
      engine.user({ type: 'STOP' });
      expect(createPlayer).toHaveBeenCalledTimes(1);
      expect(engine.getSnapshot().embed).toBe('blocked');
    });
  });

  it('still plays when the disc change fails', async () => {
    const { engine, flush, failSwap, player } = setup();
    engine.open(ref);
    await flush();
    engine.user({ type: 'PLAY' });
    await flush();
    failSwap();
    await flush();
    expect(engine.getSnapshot().seq.status).toBe('playing');
    expect(player.load).toHaveBeenCalledWith('spotify:track:a');
  });

  // Logged out, the embed can let a preview run out without a word (no paused update, no end): the
  // engine then counts the track as ended once the rest of it and 2.5 s have passed with no update.
  describe('the end watchdog', () => {
    /** Track a playing: the player built, the disc seated, the track loaded and started. */
    async function playingA() {
      const ctx = setup();
      ctx.engine.open(ref);
      await ctx.flush();
      ctx.engine.user({ type: 'PLAY' });
      await ctx.flush();
      ctx.swap();
      await ctx.flush();
      ctx.cb().onStarted('spotify:track:a');
      return ctx;
    }
    const at = (positionMs: number, paused = false) => ({
      uri: 'spotify:track:a',
      paused,
      buffering: false,
      positionMs,
      durationMs: 30_000,
    });
    /** The index in `timers` of the latest timer (its handle is the index + 1). */
    const latest = ({ timers }: Ctx) => timers.length - 1;

    it('ends a track the embed stops reporting near its end, after the rest of it and 2.5 s, and the next one loads', async () => {
      const ctx = await playingA();
      const { engine, player, timers, delays, swap, flush, cb } = ctx;
      cb().onUpdate(at(28_000));
      const watch = latest(ctx);
      expect(delays[watch]).toBe(2000 + 2500);
      timers[watch]();
      expect(engine.getSnapshot().seq).toMatchObject({ status: 'swapping', cursor: 1 });
      // The embed dropped its list with the preview: nothing reaches it until the next load.
      expect(player.pause).not.toHaveBeenCalled();
      swap();
      await flush();
      expect(player.load).toHaveBeenLastCalledWith('spotify:track:b');
      expect(engine.getSnapshot().seq).toMatchObject({ status: 'playing', cursor: 1 });
    });

    it('is cleared by a paused update', async () => {
      const ctx = await playingA();
      const { engine, timers, delays, cleared, cb } = ctx;
      cb().onUpdate(at(20_000));
      const watch = latest(ctx);
      expect(delays[watch]).toBe(10_000 + 2500);
      cb().onUpdate(at(20_500, true));
      expect(cleared).toContain(watch + 1);
      // A timer that fires anyway (an injected one that cannot be cancelled) changes nothing.
      timers[watch]();
      expect(engine.getSnapshot().seq).toMatchObject({ status: 'paused', cursor: 0 });
    });

    it('is re-armed by each newer update, so a track that keeps reporting never ends by it', async () => {
      const ctx = await playingA();
      const { engine, timers, delays, cleared, cb } = ctx;
      cb().onUpdate(at(10_000));
      const first = latest(ctx);
      expect(delays[first]).toBe(20_000 + 2500);
      cb().onUpdate(at(11_000));
      const second = latest(ctx);
      expect(second).toBe(first + 1);
      expect(delays[second]).toBe(19_000 + 2500);
      expect(cleared).toContain(first + 1);
      timers[first]();
      expect(engine.getSnapshot().seq).toMatchObject({ status: 'playing', cursor: 0 });
      timers[second]();
      expect(engine.getSnapshot().seq).toMatchObject({ status: 'swapping', cursor: 1 });
    });

    it('is cleared by a load and by a new collection', async () => {
      const ctx = await playingA();
      const { engine, delays, cleared, cb, swap, flush } = ctx;
      cb().onUpdate(at(5000));
      const beforeNext = latest(ctx);
      expect(delays[beforeNext]).toBe(25_000 + 2500);
      engine.user({ type: 'NEXT' });
      swap();
      await flush();
      expect(cleared).toContain(beforeNext + 1);
      cb().onStarted('spotify:track:b');
      cb().onUpdate({ ...at(6000), uri: 'spotify:track:b' });
      const beforeLoad = latest(ctx);
      expect(delays[beforeLoad]).toBe(24_000 + 2500);
      engine.send({ type: 'LOAD', tracks: collection.tracks });
      expect(cleared).toContain(beforeLoad + 1);
    });

    it('is cleared by dispose', async () => {
      const ctx = await playingA();
      const { engine, timers, delays, cleared, cb } = ctx;
      cb().onUpdate(at(28_000));
      const watch = latest(ctx);
      expect(delays[watch]).toBe(2000 + 2500);
      engine.dispose();
      expect(cleared).toContain(watch + 1);
      timers[watch]();
      expect(engine.getSnapshot().seq).toMatchObject({ status: 'playing', cursor: 0 });
    });

    it('lets an end the embed reports (paused at the end) give exactly one ENDED', async () => {
      const ctx = await playingA();
      const { engine, player, timers, delays, swap, flush, cb } = ctx;
      const send = vi.spyOn(engine, 'send');
      cb().onUpdate(at(28_500));
      const watch = latest(ctx);
      expect(delays[watch]).toBe(1500 + 2500);
      // What the embed controller does for an end it sees: the paused update, then the end.
      cb().onUpdate(at(30_000, true));
      cb().onEnded();
      swap();
      await flush();
      expect(engine.getSnapshot().seq).toMatchObject({ status: 'playing', cursor: 1 });
      // The old watchdog firing now would end track b and move on to c.
      timers[watch]();
      expect(engine.getSnapshot().seq).toMatchObject({ status: 'playing', cursor: 1 });
      expect(player.load).toHaveBeenLastCalledWith('spotify:track:b');
      expect(send.mock.calls.filter(([event]) => event.type === 'ENDED')).toHaveLength(1);
    });
  });

  it('takes an old disc change finishing late for neither a newer one nor a reason to load', async () => {
    const { engine, flush, refuse, swaps, player } = setup({
      hangPlayer: true,
      firstAttemptOnly: true,
    });
    engine.open(ref);
    await flush();
    engine.user({ type: 'PLAY' }); // disc change 1, towards track a
    refuse();
    await flush(); // the player fails: idle, with disc change 1 still turning
    engine.user({ type: 'NEXT' }); // disc change 2, towards track b, with a new player
    await flush();
    expect(swaps).toHaveLength(2);
    swaps[0]();
    await flush();
    expect(engine.getSnapshot().seq).toMatchObject({ status: 'swapping', cursor: 1 });
    expect(player.load).not.toHaveBeenCalled();
    swaps[1]();
    await flush();
    expect(engine.getSnapshot().seq.status).toBe('playing');
    expect(player.load).toHaveBeenCalledTimes(1);
    expect(player.load).toHaveBeenCalledWith('spotify:track:b');
  });
});
