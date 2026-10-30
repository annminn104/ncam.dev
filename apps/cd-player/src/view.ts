import type { SceneView, TrackView } from './bridge';
import { currentIndex, upcomingIndices, type SeqState } from './playback/sequencer';
import {
  pickPicture,
  type ArtistDetail,
  type Collection,
  type Palette,
  type Track,
  type TrackDetail,
} from './spotify/types';

/** What the views are built from: the engine's snapshot, or any object with these fields. */
export interface ViewSource {
  collection: Collection | null;
  seq: SeqState;
  details: ReadonlyMap<string, TrackDetail>;
  artists: ReadonlyMap<string, ArtistDetail>;
}

const ART_PX = 640;
/** How many of the next tracks the scene shows: the rack in the lid has a slot for each. */
export const UPCOMING = 5;

export function trackView(
  track: Track,
  details: ReadonlyMap<string, TrackDetail>,
  artists: ReadonlyMap<string, ArtistDetail>,
): TrackView {
  const detail = details.get(track.id) ?? null;
  const art = detail ? (pickPicture(detail.art, ART_PX)?.url ?? null) : null;
  const artistId = detail?.artists[0]?.id;
  const artist = artistId ? artists.get(artistId) : undefined;
  const photo = artist ? (pickPicture(artist.images, ART_PX)?.url ?? null) : null;
  return {
    id: track.id,
    title: track.title,
    artists: track.artists,
    artUrl: art,
    artistUrl: photo ?? art,
    palette: detail?.palette ?? null,
  };
}

export function sceneView(source: ViewSource): SceneView {
  const { seq } = source;
  const index = currentIndex(seq);
  const view = (i: number) => trackView(seq.tracks[i], source.details, source.artists);
  return {
    collection: source.collection
      ? { name: source.collection.name, subtitle: source.collection.subtitle }
      : null,
    current: index === null ? null : view(index),
    upcoming: upcomingIndices(seq, UPCOMING).map(view),
    trackNo: index === null ? 0 : index + 1,
    total: seq.tracks.length,
    status: seq.status,
    positionMs: seq.positionMs,
    durationMs: seq.durationMs,
  };
}

/** The art behind the page: the current track's, else the first one waiting in the lid. */
export function backdropFor(source: ViewSource): {
  artUrl: string | null;
  palette: Palette | null;
} {
  const view = sceneView(source);
  const track = view.current ?? view.upcoming[0] ?? null;
  return { artUrl: track?.artUrl ?? null, palette: track?.palette ?? null };
}

export function nowPlayingFor(
  source: ViewSource,
): { title: string; artists: string; trackNo: number; total: number } | null {
  const index = currentIndex(source.seq);
  if (index === null) return null;
  const track = source.seq.tracks[index];
  return {
    title: track.title,
    artists: track.artists,
    trackNo: index + 1,
    total: source.seq.tracks.length,
  };
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The seek slider's range in whole seconds, floored like `formatDuration`, so the number the
 * slider holds is the one the time reads. The position never reads past the end.
 */
export function seekRange(positionMs: number, durationMs: number): { max: number; value: number } {
  const max = Math.max(0, Math.floor(durationMs / 1000));
  const value = Math.min(max, Math.max(0, Math.floor(positionMs / 1000)));
  return { max, value };
}

/**
 * The loader's one line: the GLB's download once its size is known, rounded and held between 0 and
 * 100 (a compressed transfer can report more than it named).
 */
export function loaderLine(progress: number | null): string {
  if (progress === null || !Number.isFinite(progress)) return 'Loading the player';
  return `Loading the player ${Math.min(100, Math.max(0, Math.round(progress * 100)))}%`;
}
