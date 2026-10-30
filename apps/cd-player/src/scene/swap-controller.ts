import type { SceneView, Swapper, TrackView } from '../bridge';
import { planChange, type Plan, type PrintOrder, type Timeline } from './director';
import {
  DISC_COPIES,
  classifyChange,
  fillShelf,
  lineupOf,
  sameCollection,
  shelfMatches,
  sizeFor,
  targetOf,
  type PrintSize,
  type StageState,
  type Target,
} from './stage';

/** Under reduced motion a change is instant; the music still waits this long for the disc. */
export const REDUCED_MOTION_MS = 300;
/** How long a change waits for its prints; past that it runs on the prints its copies have. */
export const PRINT_WAIT_MS = 1500;
/**
 * A timeline also ends on the clock this long after its time is up, for when no frame comes to
 * end it: a page hidden mid-change (a background tab, a locked phone) draws none.
 */
export const SETTLE_SLACK_MS = 250;

/**
 * Prints the disc copies and the booklet's two sides. Each print may be aborted through `signal`
 * once a newer print of the same copy (or side) starts: check it before drawing, so a stale print
 * never covers a newer one. A change waits for its first prints at most PRINT_WAIT_MS, then runs
 * on what the copies show; a print that lands later still shows.
 */
export interface DiscPrinter {
  /** Prints `view` on disc copy `disc`, `size` px square. */
  disc(disc: number, view: TrackView, size: PrintSize, signal?: AbortSignal): Promise<void>;
  /** Prints the booklet's side `side` for `view` (null: the page's own cover). */
  booklet(side: 0 | 1, view: TrackView | null, signal?: AbortSignal): Promise<void>;
  /** Loads what a print of `view` needs (its pictures, the faces), so that print is quick later. */
  preload(view: TrackView): Promise<void>;
  /** What copy `disc` shows: for the dev server's `window.__cdpStage`. */
  printed?(disc: number): { track: string | null; size: number; landed: boolean };
}

export interface SwapClock {
  now(): number;
  /** Calls `done` once after `ms`; the function it returns cancels that. */
  after(ms: number, done: () => void): () => void;
}

export interface SwapControllerOptions {
  stage: StageState;
  printer: DiscPrinter;
  /** The bridge's view: the engine publishes the one a swap leads to before it asks for it. */
  view(): SceneView;
  reduced: boolean;
  /** Whether the page is hidden now (a background tab, a locked phone): no frame runs then. */
  hidden(): boolean;
  clock: SwapClock;
  /** A print failed (art that would not load): the change goes on with what the copy shows. */
  onPrintFailed(error: unknown, view: TrackView): void;
}

export interface SwapController {
  /** The bridge's swapper: one change at a time, and every change settles. */
  swap: Swapper;
  /**
   * As the scene boots: fills the shelf from `view` at once (the track in the player on the
   * spindle, mid-playback included; the rack; the booklet) and prints it. Once per stage.
   */
  seat(view: SceneView): void;
  /**
   * Each frame between changes: a view that changed with no swap (a new collection, Shuffle,
   * Repeat) starts a cascade that nobody waits for.
   */
  follow(view: SceneView): void;
  /**
   * Hands the change in progress to `pose` (its plan and the ms into it, 0 while its prints are
   * painted) and ends it once its time is up, after its last pose. False between changes, and
   * during the reduced-motion beat (the stage is already done then: the resting pose shows it).
   */
  frame(pose: (plan: Plan, t: number) => void): boolean;
  /** The change in progress: for the dev server's `window.__cdpStage`. */
  inspect(): { timeline: Timeline; t: number } | null;
  /** The scene is going: the change in progress settles at once. */
  dispose(): void;
}

interface Change {
  plan: Plan;
  /**
   * printing, then turning (the timeline, from `start`); under reduced motion held instead (done
   * on the stage, the music waits a beat); ended once settled.
   */
  phase: 'printing' | 'turning' | 'held' | 'ended';
  start: number;
  /** The prints the timeline gives out as it reaches them (`at` > 0). */
  later: PrintOrder[];
  /** Finishes it on the stage (if it is not already), gives out its prints and resolves; once. */
  end(): void;
}

interface Keys {
  discs: (AbortController | null)[];
  booklet: [AbortController | null, AbortController | null];
}

/**
 * Each stage's print in progress on each copy and booklet side. Kept per stage, not per
 * controller, so a print from a controller that has gone (a remount) is still told to give up
 * when a newer one starts.
 */
const printing = new WeakMap<StageState, Keys>();

function keysFor(stage: StageState): Keys {
  let keys = printing.get(stage);
  if (!keys) {
    keys = { discs: Array.from({ length: DISC_COPIES }, () => null), booklet: [null, null] };
    printing.set(stage, keys);
  }
  return keys;
}

const followKey = (target: Target) =>
  [target.current?.id ?? '', ...target.upcoming.map(({ id }) => id)].join('\n');

/**
 * The disc changes, as the rules that make each one settle (the engine waits in `swapping` until
 * a swap does): a new change first ends the one in progress (a collection pasted mid-change, then
 * Play), a print that fails or keeps it waiting never stops one, a hidden page (which draws no
 * frame) never holds one up, and the teardown settles it. No React and no renderer, on an
 * injected clock, so node tests can drive it; useDirector draws its poses.
 */
export function createSwapController(options: SwapControllerOptions): SwapController {
  const { stage, printer, view, reduced, hidden, clock, onPrintFailed } = options;
  const keys = keysFor(stage);
  let current: Change | null = null;
  let disposed = false;
  /** The last target a cascade was planned for: one that cannot reach it is not run every frame. */
  let followed: string | null = null;

  // A newer print of a copy aborts the older one's signal, so a late print never covers it.
  const give = async (order: PrintOrder): Promise<void> => {
    keys.discs[order.disc]?.abort();
    const key = new AbortController();
    keys.discs[order.disc] = key;
    try {
      await printer.disc(order.disc, order.view, order.size, key.signal);
    } catch (error) {
      onPrintFailed(error, order.view);
    } finally {
      if (keys.discs[order.disc] === key) keys.discs[order.disc] = null;
    }
  };

  const printBooklet = async (side: 0 | 1, track: TrackView | null): Promise<void> => {
    keys.booklet[side]?.abort();
    const key = new AbortController();
    keys.booklet[side] = key;
    try {
      await printer.booklet(side, track, key.signal);
    } catch (error) {
      if (track) onPrintFailed(error, track);
    } finally {
      if (keys.booklet[side] === key) keys.booklet[side] = null;
    }
  };

  const preload = async (track: TrackView): Promise<void> => {
    try {
      await printer.preload(track);
    } catch {
      // The print itself reports a failure.
    }
  };

  /** What a change leaves behind: its shelf, the booklet turned to its new print. */
  const settle = (plan: Plan): void => {
    stage.shelf = plan.after;
    if (plan.flip) stage.bookletFront = stage.bookletFront === 0 ? 1 : 0;
    stage.swapping = false;
  };

  const begin = (plan: Plan, done: () => void): void => {
    current?.end();
    stage.swapping = true;
    // The pending wait: for the prints, then the timeline's fallback or the reduced-motion beat.
    let cancel = () => {};
    const change: Change = {
      plan,
      phase: 'printing',
      start: 0,
      later: plan.prints.filter((order) => order.at > 0),
      end: () => {
        if (change.phase === 'ended') return;
        cancel();
        const later = change.later.splice(0);
        if (!disposed) for (const order of later) void give(order);
        if (change.phase !== 'held') settle(plan);
        change.phase = 'ended';
        if (current === change) current = null;
        done();
      },
    };
    // The prints returned or the wait ran out, whichever came first; a late print still lands.
    const printed = () => {
      if (change.phase !== 'printing') return;
      cancel();
      if (disposed || hidden()) {
        // A hidden page draws no frame to play the timeline in: the change is done at once.
        change.end();
      } else if (reduced) {
        for (const order of change.later.splice(0)) void give(order);
        settle(plan);
        change.phase = 'held';
        cancel = clock.after(REDUCED_MOTION_MS, change.end);
      } else {
        change.phase = 'turning';
        change.start = clock.now();
        // Frames end it; the clock does too, should the page be hidden before they can.
        cancel = clock.after(plan.duration + SETTLE_SLACK_MS, change.end);
      }
    };
    current = change;
    const first: Promise<void>[] = plan.prints.filter((order) => order.at === 0).map(give);
    for (const order of change.later) first.push(preload(order.view));
    if (plan.flip) first.push(printBooklet(stage.bookletFront === 0 ? 1 : 0, plan.flip.booklet));
    void Promise.all(first).then(printed);
    // Asked for in a hidden page (the next track of a background tab): done at once, without
    // waiting for its prints, which still land on their copies whenever they can.
    if (hidden()) change.end();
    else cancel = clock.after(PRINT_WAIT_MS, printed);
  };

  const swap: Swapper = (to) =>
    new Promise<void>((resolve) => {
      // The change in progress ends first, so this one reads against the shelf it leaves.
      current?.end();
      followed = null;
      const after = view();
      const change = classifyChange(lineupOf(stage.shelf), after, to);
      begin(planChange(change, stage.shelf, targetOf(after, to), stage.last), resolve);
    });

  return {
    swap,
    seat: (next) => {
      if (disposed || stage.filled || current) return;
      stage.filled = true;
      const shelf = fillShelf(targetOf(next));
      stage.shelf = shelf;
      if (shelf.spindle !== null) {
        const track = shelf.tracks[shelf.spindle];
        if (track) void give({ disc: shelf.spindle, view: track, size: sizeFor('spindle'), at: 0 });
      }
      shelf.rack.forEach((disc, slot) => {
        const track = disc === null ? null : shelf.tracks[disc];
        if (disc !== null && track) void give({ disc, view: track, size: sizeFor(slot), at: 0 });
      });
      void printBooklet(stage.bookletFront, shelf.booklet);
    },
    follow: (next) => {
      if (disposed || current || !stage.filled) return;
      const target = targetOf(next);
      if (shelfMatches(stage.shelf, target)) {
        // A collection's new label alone moves no disc.
        if (!sameCollection(stage.shelf.collection, target.collection)) {
          stage.shelf = { ...stage.shelf, collection: target.collection };
        }
        followed = null;
        return;
      }
      const key = followKey(target);
      if (key === followed) return;
      followed = key;
      const change = classifyChange(lineupOf(stage.shelf), next, null);
      begin(planChange(change, stage.shelf, target, stage.last), () => {});
    },
    frame: (pose) => {
      const change = current;
      if (!change || change.phase === 'held') return false;
      // Its prints are still being painted: the change holds its first pose.
      if (change.phase === 'printing') {
        pose(change.plan, 0);
        return true;
      }
      const t = clock.now() - change.start;
      if (change.later.length > 0) {
        const due = change.later.filter((order) => order.at <= t);
        if (due.length > 0) {
          change.later = change.later.filter((order) => order.at > t);
          for (const order of due) void give(order);
        }
      }
      pose(change.plan, t);
      if (t >= change.plan.duration) change.end();
      return true;
    },
    inspect: () =>
      current
        ? {
            timeline: current.plan.timeline,
            t: current.phase === 'turning' ? clock.now() - current.start : 0,
          }
        : null,
    dispose: () => {
      disposed = true;
      current?.end();
    },
  };
}
