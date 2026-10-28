import type { SpotifyEmbedController, SpotifyIFrameAPI, SpotifyPlaybackData } from './iframe-types';

/**
 * The official Spotify embed, driven from our own controls. The script loads on the visitor's first
 * play action, never with the page: that click is the activation the browser's autoplay policy
 * wants, and the embed's third-party cookies stay out of the first load. Logged-in visitors hear
 * full tracks; everyone else gets Spotify's 30 s previews.
 */
export const IFRAME_API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';

export interface PlaybackUpdate {
  uri: string | null;
  paused: boolean;
  buffering: boolean;
  positionMs: number;
  durationMs: number;
}

export function toUpdate(data: SpotifyPlaybackData): PlaybackUpdate {
  return {
    uri: data.playingURI ?? null,
    paused: data.isPaused,
    buffering: data.isBuffering,
    positionMs: Math.max(0, data.position || 0),
    durationMs: Math.max(0, data.duration || 0),
  };
}

/** A track has played out: paused at its end, or snapped back to 0 just after being near it. */
export function hasEnded(previous: PlaybackUpdate | null, next: PlaybackUpdate): boolean {
  if (next.buffering || next.durationMs <= 0) return false;
  if (next.paused && next.positionMs >= next.durationMs - 500) return true;
  return (
    !!previous &&
    next.paused &&
    next.positionMs === 0 &&
    previous.uri === next.uri &&
    previous.durationMs > 0 &&
    previous.positionMs >= previous.durationMs - 1500
  );
}

let api: Promise<SpotifyIFrameAPI> | null = null;

/** Adds Spotify's script once; a failed or blocked load is tried again on the next call. */
export function loadIframeApi(
  host: { doc: Document; win: Window } = { doc: document, win: window },
  timeoutMs = 15_000,
): Promise<SpotifyIFrameAPI> {
  if (api) return api;
  api = new Promise<SpotifyIFrameAPI>((resolve, reject) => {
    const fail = (message: string) => {
      clearTimeout(timer);
      api = null;
      reject(new Error(message));
    };
    const timer = setTimeout(() => fail('the Spotify player did not load in time'), timeoutMs);
    const previous = host.win.onSpotifyIframeApiReady;
    host.win.onSpotifyIframeApiReady = (loaded) => {
      clearTimeout(timer);
      previous?.(loaded);
      resolve(loaded);
    };
    const script = host.doc.createElement('script');
    script.src = IFRAME_API_SRC;
    script.async = true;
    script.onerror = () => fail('the Spotify player was blocked');
    host.doc.head.appendChild(script);
  });
  return api;
}

/** Tests only: forget the loaded API. */
export function resetIframeApi(): void {
  api = null;
}

export interface EmbedCallbacks {
  onStarted(uri: string): void;
  onUpdate(update: PlaybackUpdate): void;
  onEnded(): void;
}

export interface EmbedPlayer {
  /** Load `uri` and play it. */
  load(uri: string): void;
  pause(): void;
  resume(): void;
  seek(ms: number): void;
  destroy(): void;
}

/**
 * Replaces `element` with Spotify's compact embed (80 px high, the card's width) showing `firstUri`.
 * Hand it an element React does not own: Spotify swaps it for its iframe.
 */
export async function createEmbedPlayer(
  element: HTMLElement,
  firstUri: string,
  callbacks: EmbedCallbacks,
  iframeApi?: SpotifyIFrameAPI,
): Promise<EmbedPlayer> {
  const IFrameAPI = iframeApi ?? (await loadIframeApi());
  const controller = await new Promise<SpotifyEmbedController>((resolve) =>
    IFrameAPI.createController(element, { uri: firstUri, width: '100%', height: 80 }, resolve),
  );
  let last: PlaybackUpdate | null = null;
  let ended = false;
  // The uri the embed should be playing: `firstUri`, then whatever `load()` was last given. A late
  // event for the track `load()` replaced (say, paused at its end) would, taken for the new
  // track's, end that one, so it is ignored whole. An event that names no track is let through.
  let expected = firstUri;
  const isLate = (uri: string | null | undefined) => !!uri && uri !== expected;
  controller.addListener('playback_started', (event) => {
    if (isLate(event.data.playingURI)) return;
    ended = false;
    callbacks.onStarted(event.data.playingURI);
  });
  controller.addListener('playback_update', (event) => {
    const next = toUpdate(event.data);
    if (isLate(next.uri)) return;
    callbacks.onUpdate(next);
    if (!ended && hasEnded(last, next)) {
      ended = true;
      callbacks.onEnded();
    }
    last = next;
  });
  return {
    load(uri) {
      expected = uri;
      ended = false;
      last = null;
      controller.loadUri(uri);
      controller.play();
    },
    pause: () => controller.pause(),
    resume: () => controller.resume(),
    seek: (ms) => controller.seek(ms / 1000),
    destroy: () => controller.destroy(),
  };
}
