import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEmbedPlayer,
  hasEnded,
  IFRAME_API_SRC,
  loadIframeApi,
  resetIframeApi,
  toUpdate,
  type PlaybackUpdate,
} from './embed-controller';
import type { SpotifyEmbedController, SpotifyIFrameAPI } from './iframe-types';

const update = (patch: Partial<PlaybackUpdate>): PlaybackUpdate => ({
  uri: 'spotify:track:a',
  paused: false,
  buffering: false,
  positionMs: 0,
  durationMs: 30_000,
  ...patch,
});

describe('hasEnded', () => {
  it('is true when paused at the end', () => {
    expect(hasEnded(null, update({ paused: true, positionMs: 29_700 }))).toBe(true);
    expect(hasEnded(null, update({ paused: false, positionMs: 29_700 }))).toBe(false);
  });

  it('is true when the embed snaps back to 0 after being near the end', () => {
    const before = update({ positionMs: 29_200 });
    expect(hasEnded(before, update({ paused: true, positionMs: 0 }))).toBe(true);
    expect(hasEnded(update({ positionMs: 3000 }), update({ paused: true, positionMs: 0 }))).toBe(
      false,
    );
  });

  it('is never true while buffering or before a duration is known', () => {
    expect(hasEnded(null, update({ paused: true, buffering: true, positionMs: 30_000 }))).toBe(
      false,
    );
    expect(hasEnded(null, update({ paused: true, durationMs: 0 }))).toBe(false);
  });
});

describe('toUpdate', () => {
  it('maps the API event data', () => {
    expect(
      toUpdate({ playingURI: 'u', isPaused: true, isBuffering: false, position: 12, duration: 34 }),
    ).toEqual({
      uri: 'u',
      paused: true,
      buffering: false,
      positionMs: 12,
      durationMs: 34,
    });
  });
});

describe('loadIframeApi', () => {
  afterEach(() => resetIframeApi());

  function fakeHost() {
    const scripts: { src: string; onerror: (() => void) | null }[] = [];
    const win: { onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void } = {};
    const doc = {
      createElement: () => ({ src: '', async: false, onerror: null }),
      head: {
        appendChild: (script: { src: string; onerror: (() => void) | null }) =>
          scripts.push(script),
      },
    };
    return { host: { doc, win } as unknown as { doc: Document; win: Window }, scripts, win };
  }

  it('adds the script once and resolves when Spotify calls back', async () => {
    const { host, scripts, win } = fakeHost();
    const first = loadIframeApi(host);
    const second = loadIframeApi(host);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(IFRAME_API_SRC);
    const api = { createController: vi.fn() } as unknown as SpotifyIFrameAPI;
    win.onSpotifyIframeApiReady?.(api);
    await expect(first).resolves.toBe(api);
    await expect(second).resolves.toBe(api);
  });

  it('rejects when the script is blocked, and tries again next time', async () => {
    const { host, scripts } = fakeHost();
    const attempt = loadIframeApi(host);
    scripts[0].onerror?.();
    await expect(attempt).rejects.toThrow(/blocked/);
    void loadIframeApi(host).catch(() => {});
    expect(scripts).toHaveLength(2);
  });
});

describe('createEmbedPlayer', () => {
  function fakeApi() {
    const listeners: Record<string, (event: { data: never }) => void> = {};
    const controller = {
      loadUri: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      seek: vi.fn(),
      destroy: vi.fn(),
      addListener: (name: string, fn: (event: { data: never }) => void) => {
        listeners[name] = fn;
      },
    } as unknown as SpotifyEmbedController;
    const api: SpotifyIFrameAPI = {
      createController: (_el, _options, callback) => callback(controller),
    };
    const emit = (name: string, data: unknown) => listeners[name]?.({ data: data as never });
    return { api, controller, emit };
  }

  it('loads and plays, seeks in seconds, and reports the end once', async () => {
    const { api, controller, emit } = fakeApi();
    const callbacks = { onStarted: vi.fn(), onUpdate: vi.fn(), onEnded: vi.fn() };
    const player = await createEmbedPlayer({} as HTMLElement, 'spotify:track:a', callbacks, api);
    player.load('spotify:track:b');
    expect(controller.loadUri).toHaveBeenCalledWith('spotify:track:b');
    expect(controller.play).toHaveBeenCalled();
    player.seek(4500);
    expect(controller.seek).toHaveBeenCalledWith(4.5);
    emit('playback_started', { playingURI: 'spotify:track:b' });
    expect(callbacks.onStarted).toHaveBeenCalledWith('spotify:track:b');
    const end = {
      playingURI: 'spotify:track:b',
      isPaused: true,
      isBuffering: false,
      position: 30_000,
      duration: 30_000,
    };
    emit('playback_update', end);
    emit('playback_update', end);
    expect(callbacks.onUpdate).toHaveBeenCalledTimes(2);
    expect(callbacks.onEnded).toHaveBeenCalledTimes(1);
  });

  describe('after load()', () => {
    /** An embed created on `first` and told to load each of `uris` in turn. */
    async function embedAfter(first: string, ...uris: string[]) {
      const { api, emit } = fakeApi();
      const callbacks = { onStarted: vi.fn(), onUpdate: vi.fn(), onEnded: vi.fn() };
      const player = await createEmbedPlayer({} as HTMLElement, first, callbacks, api);
      for (const uri of uris) player.load(uri);
      return { callbacks, emit };
    }
    const data = (patch: Record<string, unknown> = {}) => ({
      playingURI: 'spotify:track:b',
      isPaused: false,
      isBuffering: false,
      position: 0,
      duration: 30_000,
      ...patch,
    });

    it('ignores a late event for the track it replaced', async () => {
      const { callbacks, emit } = await embedAfter('spotify:track:a', 'spotify:track:b');
      const atEnd = data({ playingURI: 'spotify:track:a', isPaused: true, position: 30_000 });
      emit('playback_started', { playingURI: 'spotify:track:a' });
      emit('playback_update', atEnd);
      expect(callbacks.onStarted).not.toHaveBeenCalled();
      expect(callbacks.onUpdate).not.toHaveBeenCalled();
      expect(callbacks.onEnded).not.toHaveBeenCalled();
      // The same update for the new track still ends it, once.
      emit('playback_update', { ...atEnd, playingURI: 'spotify:track:b' });
      expect(callbacks.onUpdate).toHaveBeenCalledTimes(1);
      expect(callbacks.onEnded).toHaveBeenCalledTimes(1);
    });

    it('lets a relinked id of the loaded track through, and it can end the track', async () => {
      const { callbacks, emit } = await embedAfter('spotify:track:a', 'spotify:track:b');
      emit('playback_started', { playingURI: 'spotify:track:b2' });
      emit(
        'playback_update',
        data({ playingURI: 'spotify:track:b2', isPaused: true, position: 30_000 }),
      );
      expect(callbacks.onStarted).toHaveBeenCalledWith('spotify:track:b2');
      expect(callbacks.onUpdate).toHaveBeenCalledTimes(1);
      expect(callbacks.onEnded).toHaveBeenCalledTimes(1);
    });

    it('does not ignore the events of a track that is loaded again', async () => {
      // The first play of a track the embed was created on, or a one-track list on repeat.
      const { callbacks, emit } = await embedAfter('spotify:track:a', 'spotify:track:a');
      emit(
        'playback_update',
        data({ playingURI: 'spotify:track:a', isPaused: true, position: 30_000 }),
      );
      expect(callbacks.onUpdate).toHaveBeenCalledTimes(1);
      expect(callbacks.onEnded).toHaveBeenCalledTimes(1);
    });

    it('ignores a late event for whichever track it replaced last', async () => {
      const { callbacks, emit } = await embedAfter(
        'spotify:track:a',
        'spotify:track:b',
        'spotify:track:c',
      );
      const atEnd = data({ isPaused: true, position: 30_000 });
      emit('playback_update', atEnd);
      expect(callbacks.onUpdate).not.toHaveBeenCalled();
      expect(callbacks.onEnded).not.toHaveBeenCalled();
      emit('playback_update', { ...atEnd, playingURI: 'spotify:track:c' });
      expect(callbacks.onEnded).toHaveBeenCalledTimes(1);
    });

    it('changes neither the last update nor the ended flag when it ignores an event', async () => {
      const { callbacks, emit } = await embedAfter('spotify:track:a', 'spotify:track:b');
      const late = data({ playingURI: 'spotify:track:a', isPaused: true, position: 30_000 });
      // `last` stays the new track's, so its snap back to 0 still counts as its end.
      emit('playback_update', data({ position: 29_200 }));
      emit('playback_update', late);
      expect(callbacks.onEnded).not.toHaveBeenCalled();
      emit('playback_update', data({ isPaused: true, position: 0 }));
      expect(callbacks.onEnded).toHaveBeenCalledTimes(1);
      // `ended` stays set, so a late start does not let the new track end a second time.
      emit('playback_started', { playingURI: 'spotify:track:a' });
      emit('playback_update', data({ isPaused: true, position: 30_000 }));
      expect(callbacks.onEnded).toHaveBeenCalledTimes(1);
    });

    it('lets an event that names no track through', async () => {
      const { callbacks, emit } = await embedAfter('spotify:track:a', 'spotify:track:b');
      emit('playback_update', data({ playingURI: undefined, isPaused: true, position: 30_000 }));
      expect(callbacks.onUpdate).toHaveBeenCalledWith(expect.objectContaining({ uri: null }));
      expect(callbacks.onEnded).toHaveBeenCalledTimes(1);
    });
  });
});
