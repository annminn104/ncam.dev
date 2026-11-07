/**
 * Spotify's iFrame API (https://open.spotify.com/embed/iframe-api/v1), as documented at
 * developer.spotify.com/documentation/embeds/references/iframe-api. Positions are milliseconds,
 * except `seek`, which takes seconds. `restart` plays the loaded item from its start (the API
 * script's `playFromStart`).
 */
export interface SpotifyPlaybackData {
  playingURI?: string;
  isPaused: boolean;
  isBuffering: boolean;
  duration: number;
  position: number;
}

export interface SpotifyEmbedController {
  loadUri(uri: string, preferVideo?: boolean, startAt?: number): void;
  play(): void;
  pause(): void;
  resume(): void;
  togglePlay(): void;
  seek(seconds: number): void;
  restart(): void;
  destroy(): void;
  addListener(event: 'ready', callback: () => void): void;
  addListener(
    event: 'playback_started',
    callback: (event: { data: { playingURI: string } }) => void,
  ): void;
  addListener(
    event: 'playback_update',
    callback: (event: { data: SpotifyPlaybackData }) => void,
  ): void;
  /**
   * The API script's own errors carry `{ code, message, recoverable }` (`invalid_uri`,
   * `playback_error`); the iframe's are passed on as they came, so the payload is not typed.
   */
  addListener(event: 'error', callback: (event: { data: unknown }) => void): void;
}

export interface SpotifyIFrameAPI {
  createController(
    element: HTMLElement,
    options: { uri?: string; url?: string; width?: number | string; height?: number | string },
    callback: (controller: SpotifyEmbedController) => void,
  ): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
  }
}
