import type { SceneView, TrackView } from '../bridge';
import { UPCOMING } from '../view';

/**
 * What the spindle and the lid's rack hold, as plain data the swap controller, the director and
 * the rig share (no three here, so node tests drive it): which disc copy is where, the track each
 * carries, the booklet's track, and how a change of track reads against them.
 */

/** The rack's slots in the lid: slot `i` holds `view.upcoming[i]`. */
export const RACK_SLOTS = UPCOMING;
/** The rig's disc copies: one on the spindle, one per slot, and one leaving. */
export const DISC_COPIES = RACK_SLOTS + 2;

/** Where a disc rests: on the spindle, or in rack slot 0 … 4 (0 the next to play). */
export type Place = 'spindle' | number;

/** A disc copy's print, px square. */
export type PrintSize = 512 | 1024;

/** The spindle's disc and the next to land print at 1024 px, the rest of the rack at 512. */
export function sizeFor(place: Place): PrintSize {
  return place === 'spindle' || place === 0 ? 1024 : 512;
}

export interface Shelf {
  /** The copy on the spindle; null when nothing is in the player. */
  spindle: number | null;
  /** The copy in each slot; the filled slots come first. */
  rack: (number | null)[];
  /** The track each copy carries; null for a copy not used yet. */
  tracks: (TrackView | null)[];
  /** The track the case's booklet shows: the one in the player, else the next to play. */
  booklet: TrackView | null;
  /** The collection the rack was filled from. */
  collection: SceneView['collection'];
}

/** What classifyChange compares: a view, or what a shelf holds. */
export type Lineup = Pick<SceneView, 'collection' | 'current' | 'upcoming'>;

/** What a change leaves on the shelf. */
export interface Target extends Lineup {
  booklet: TrackView | null;
}

/** What the stage keeps between frames and changes (the rig carries it). */
export interface StageState {
  shelf: Shelf;
  /** Which of the booklet's two prints shows; the other is the next turn's. */
  bookletFront: 0 | 1;
  /** The shelf has been filled from a view (`seat`, as the scene boots). */
  filled: boolean;
  /** A change is running. */
  swapping: boolean;
  /** Where the last pose left the arm (radians from its base) and the spin (a share of full speed). */
  last: { armAngle: number; spin: number };
}

/**
 * How a change reads. `first` and `next` land slot 0's disc (`first` with nothing on the
 * spindle), `pick` lands the disc in `slot`, `prev` sends the spindle's disc back to slot 0,
 * `side` brings in a track the rack does not hold; `collection` is another collection, with a
 * swap or without, and `restack` a view that changed with no swap in the same one (Shuffle,
 * Repeat).
 */
export type ChangeKind = 'first' | 'next' | 'prev' | 'pick' | 'side' | 'collection' | 'restack';

export interface ChangeOf {
  kind: ChangeKind;
  /** The slot the arriving disc flies from (`first`, `next`, `pick`); null otherwise. */
  slot: number | null;
}

const idOf = (track: TrackView | null | undefined): string | null => track?.id ?? null;

export function emptyShelf(): Shelf {
  return {
    spindle: null,
    rack: Array.from({ length: RACK_SLOTS }, () => null),
    tracks: Array.from({ length: DISC_COPIES }, () => null),
    booklet: null,
    collection: null,
  };
}

/** What `view` asks the shelf to hold; `to` is the track a swap brings to the spindle. */
export function targetOf(view: Lineup, to: TrackView | null = null): Target {
  const current = to ?? view.current;
  const upcoming = view.upcoming.slice(0, RACK_SLOTS);
  return {
    collection: view.collection,
    current,
    upcoming,
    booklet: current ?? upcoming[0] ?? null,
  };
}

/** What `shelf` holds, as a lineup: the spindle's track and the filled slots'. */
export function lineupOf(shelf: Shelf): Lineup {
  const upcoming: TrackView[] = [];
  for (const disc of shelf.rack) {
    const track = disc === null ? null : shelf.tracks[disc];
    if (!track) break;
    upcoming.push(track);
  }
  const current = shelf.spindle === null ? null : shelf.tracks[shelf.spindle];
  return { collection: shelf.collection, current, upcoming };
}

/** A shelf that holds `target` already, as when the scene boots: the spindle's copy first. */
export function fillShelf(target: Target): Shelf {
  const shelf = emptyShelf();
  let next = 0;
  if (target.current) {
    shelf.spindle = next;
    shelf.tracks[next++] = target.current;
  }
  target.upcoming.forEach((track, slot) => {
    shelf.rack[slot] = next;
    shelf.tracks[next++] = track;
  });
  shelf.booklet = target.booklet;
  shelf.collection = target.collection;
  return shelf;
}

/** Whether the shelf holds the target's tracks (the collection's label aside). */
export function shelfMatches(shelf: Shelf, target: Target): boolean {
  const held = lineupOf(shelf);
  return (
    idOf(held.current) === idOf(target.current) &&
    idOf(shelf.booklet) === idOf(target.booklet) &&
    held.upcoming.length === target.upcoming.length &&
    held.upcoming.every((track, slot) => track.id === target.upcoming[slot].id)
  );
}

export function sameCollection(a: Lineup['collection'], b: Lineup['collection']): boolean {
  if (!a || !b) return a === b;
  return a.name === b.name && a.subtitle === b.subtitle;
}

/**
 * Reads a change against what the shelf holds (`before`) and the view it leads to (`after`: the
 * engine publishes it before it asks for the swap); `to` is the track a swap brings, null for a
 * view that changed with no swap. The rules, in order: another collection (its name or subtitle
 * differ); the track in the player is the new `upcoming[0]` (prev); `to` is in slot 0 (next, or
 * first with nothing on the spindle); `to` is further down the rack (a pick from its slot);
 * anything else comes from the side, as does any change against an empty rack. Tracks match by
 * id, so a track a playlist holds twice is one track here: of two slots holding it, the one whose
 * next slot holds the new `upcoming[0]` is the one played, else the first. A list of two tracks on
 * Repeat reads Next as prev (the next track is the previous one too); its end is the same.
 */
export function classifyChange(before: Lineup, after: Lineup, to: TrackView | null): ChangeOf {
  const other = !sameCollection(before.collection, after.collection);
  if (!to) return { kind: other ? 'collection' : 'restack', slot: null };
  if (other) return { kind: 'collection', slot: null };
  if (before.current && idOf(after.upcoming[0]) === before.current.id) {
    return { kind: 'prev', slot: null };
  }
  const holding = before.upcoming.flatMap((track, slot) => (track.id === to.id ? [slot] : []));
  const next = idOf(after.upcoming[0]);
  const slot = holding.find((held) => idOf(before.upcoming[held + 1]) === next) ?? holding[0];
  if (slot === undefined) return { kind: 'side', slot: null };
  if (slot === 0) return { kind: before.current ? 'next' : 'first', slot };
  return { kind: 'pick', slot };
}
