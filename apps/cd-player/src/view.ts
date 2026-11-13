import type { SceneView, TrackView } from './bridge';
import { currentIndex, upcomingIndices, type SeqState } from './playback/sequencer';
import type { ModelId } from './models';
import type { ModelLoad } from './scene-props';
import {
  pickPicture,
  type ArtistDetail,
  type Collection,
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
  };
}

export function sceneView(source: ViewSource): SceneView {
  const { seq } = source;
  const index = currentIndex(seq);
  const view = (i: number) => trackView(seq.tracks[i], source.details, source.artists);
  return {
    collection: source.collection
      ? {
          name: source.collection.name,
          subtitle: source.collection.subtitle,
          key: `${source.collection.type}:${source.collection.id}`,
        }
      : null,
    current: index === null ? null : view(index),
    upcoming: upcomingIndices(seq, UPCOMING).map(view),
    trackNo: index === null ? 0 : index + 1,
    total: seq.tracks.length,
    status: seq.status,
    stopped: seq.stopped,
    positionMs: seq.positionMs,
    durationMs: seq.durationMs,
  };
}

/** The art behind the page: the current track's, else the first one waiting in the lid. */
export function backdropFor(source: ViewSource): { artUrl: string | null } {
  const view = sceneView(source);
  const track = view.current ?? view.upcoming[0] ?? null;
  return { artUrl: track?.artUrl ?? null };
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
 * The loader's count: the GLB's download (0–1, null while its size is unknown) as a whole percent,
 * held between 0 and 100 (defensive: `downloadModel` reports at most 0.99 before its end's 1). What
 * `App` keeps, so the download's chunks re-render the page once per percent at most.
 */
export function loaderPercent(progress: number | null): number | null {
  if (progress === null || !Number.isFinite(progress)) return null;
  return Math.min(100, Math.max(0, Math.round(progress * 100)));
}

/**
 * Whether a model change's report (PlayerSceneProps.onModel) only repeats the last one's count: the
 * same model downloading at the same whole percent (`loaderPercent`). `App` keeps a change's
 * download once per percent, as it keeps the boot's; a size still unknown is kept as it comes.
 */
export function sameLoadPercent(last: ModelLoad | null, next: ModelLoad): boolean {
  if (last?.status !== 'loading' || next.status !== 'loading' || last.model !== next.model) {
    return false;
  }
  const percent = loaderPercent(next.fraction);
  return percent !== null && percent === loaderPercent(last.fraction);
}

/**
 * What the picker says of a model change: the report while its `model` is the one the visitor last
 * asked for, else nothing. A change given up before it loads stays silent (the visitor asked for
 * the other model), and one that failed says so after the look went back, until they ask again.
 */
export function pickerLoad(load: ModelLoad | null, asked: ModelId): ModelLoad | null {
  return load?.model === asked ? load : null;
}

/**
 * The model whose colours the page wears: the one on the stage once the scene is live, so a
 * change turns the page as its model comes on show (and a change that fails never does), else
 * the one chosen, which the boot loads.
 */
export function accentModelFor(live: boolean, onShow: ModelId | null, chosen: ModelId): ModelId {
  return live && onShow !== null ? onShow : chosen;
}

/** The loader's one line, with the count (`loaderPercent`) once the GLB's size is known. */
export function loaderLine(percent: number | null): string {
  return percent === null ? 'Loading the player' : `Loading the player ${percent}%`;
}
