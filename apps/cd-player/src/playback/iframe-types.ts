/**
 * Spotify's iFrame API (https://open.spotify.com/embed/iframe-api/v1), as documented at
 * developer.spotify.com/documentation/embeds/references/iframe-api. Positions are milliseconds,
 * except `seek`, which takes seconds.
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
