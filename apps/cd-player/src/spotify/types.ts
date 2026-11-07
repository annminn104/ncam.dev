import type { CollectionType } from '../routes';

/** One track of a playlist or album, as the proxy serves it. Zod-free: the client imports it. */
export interface Track {
  id: string;
  uri: string;
  title: string;
  /** The artists as Spotify writes them under the title: "KAROL G, Judeline, rusowsky". */
  artists: string;
  durationMs: number;
  playable: boolean;
  explicit: boolean;
}

export interface Collection {
  type: CollectionType;
  id: string;
  name: string;
  /** The owner (playlists) or the artist (albums). */
  subtitle: string;
  tracks: Track[];
}

export interface Picture {
  url: string;
  width: number;
}

/** Spotify's own colours for an item, as CSS colours. */
export interface Palette {
  background: string;
  tinted: string;
  text: string;
}

export interface TrackDetail {
  id: string;
  /** The album art, smallest first. */
  art: Picture[];
  palette: Palette | null;
  artists: { id: string; name: string }[];
}

export interface ArtistDetail {
  id: string;
  name: string;
  /** The artist's photo, smallest first. */
  images: Picture[];
  palette: Palette | null;
}

/** The largest picture no wider than `max`, else the smallest there is; null when there are none. */
export function pickPicture(pictures: readonly Picture[], max: number): Picture | null {
  if (pictures.length === 0) return null;
  const sorted = [...pictures].sort((a, b) => a.width - b.width);
  const fitting = sorted.filter((picture) => picture.width <= max);
  return fitting.length ? fitting[fitting.length - 1] : sorted[0];
}
