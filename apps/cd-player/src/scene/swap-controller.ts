import type { SceneView, Swapper, TrackView } from '../bridge';
import { DURATION, type SwapKind } from './director';
import { finishSwap, type ChangeState } from './rig';

/** Under reduced motion a change is instant; the music still waits this long for the disc. */
export const REDUCED_MOTION_MS = 300;
/** How long a change waits for its prints; past that it runs on the prints its disc has. */
export const PRINT_WAIT_MS = 1500;
/**
 * A timeline also ends on the clock this long after its time is up, for when no frame comes to
 * end it: a page hidden mid-change (a background tab, a locked phone) draws none.
 */
export const SETTLE_SLACK_MS = 250;

/**
 * Prints `view` on disc `index` and its case's booklet. A change waits for it at most
 * PRINT_WAIT_MS, then runs on the prints the disc has; a print that lands later still shows. The
 * director aborts `signal` once a newer print of the same disc starts: check it before drawing, so
 * a stale print never covers a newer one.
 */
export type Painter = (index: 0 | 1, view: TrackView, signal?: AbortSignal) => Promise<void>;

export interface SwapClock {
  now(): number;
  /** Calls `done` once after `ms`; the function it returns cancels that. */
  after(ms: number, done: () => void): () => void;
}

export interface SwapControllerOptions {
  rig: ChangeState;
  paint: Painter;
  reduced: boolean;
  /** Whether the page is hidden now (a background tab, a locked phone): no frame runs then. */
  hidden(): boolean;
  clock: SwapClock;
  /** A print failed (art that would not load): the change goes on with the print the disc has. */
  onPrintFailed(error: unknown, view: TrackView): void;
}

export interface SwapController {
  /** The bridge's swapper: one change at a time, and every change settles. */
  swap: Swapper;
  /** Prints `view` on disc `index` and its case; a failure is reported, never thrown. */
  print(index: 0 | 1, view: TrackView): Promise<void>;
  /**
   * A track playing (or paused) with no disc seated and no change running, as when the scene
   * boots mid-playback or the engine loads the track with no change: seats the lid's disc and
   * prints it for that track.
   */
  seat(view: SceneView): void;
  /**
   * Hands the change in progress to `pose` (its kind and the ms into it, 0 while its prints are
   * painted) and ends it once its time is up, after its last pose. False between changes, and
   * during the reduced-motion beat (the rig is already done then: the resting pose shows it).
   */
  frame(pose: (kind: SwapKind, t: number) => void): boolean;
  /** The scene is going: every change settles at once. */
  dispose(): void;
}

interface Change {
  kind: SwapKind;
  /**
   * printing, then turning (the timeline, from `start`); under reduced motion held instead (done on
   * the rig, the music waits a beat); ended once settled.
   */
  phase: 'printing' | 'turning' | 'held' | 'ended';
  start: number;
  /** Finishes it on the rig (if it is not already) and resolves it; once. */
  end(): void;
}

/**
 * Each rig's print in progress on each disc. Kept per rig, not per controller, so a print from
 * a controller that has gone (a remount) is still told to give up when a newer one starts.
 */
const printing = new WeakMap<ChangeState, [AbortController | null, AbortController | null]>();

/**
 * The disc changes the bridge asks for, as the rules that make each one settle (the engine waits
 * in `swapping` until it does): a new change first ends the one in progress (a collection pasted
 * mid-change, then Play), a print that fails or keeps it waiting never stops one, a hidden page
 * (which draws no frame) never holds one up, and the teardown settles them all. No React and no
 * renderer, on an injected clock, so node tests can drive it; useDirector draws its poses.
 */
export function createSwapController(options: SwapControllerOptions): SwapController {
  const { rig, paint, reduced, hidden, clock, onPrintFailed } = options;
  let current: Change | null = null;
  let disposed = false;

  // A newer print of a disc aborts the older one's signal, so a late print never covers it.
  const print = async (index: 0 | 1, view: TrackView): Promise<void> => {
    let pending = printing.get(rig);
    if (!pending) printing.set(rig, (pending = [null, null]));
    pending[index]?.abort();
    const key = new AbortController();
    pending[index] = key;
    try {
      await paint(index, view, key.signal);
    } catch (error) {
      onPrintFailed(error, view);
    } finally {
      if (pending[index] === key) pending[index] = null;
    }
  };

  const swap: Swapper = (to) => {
    current?.end();
    const kind: SwapKind = rig.seated === null ? 'insert' : 'change';
    const target: 0 | 1 = kind === 'insert' ? rig.lidCase : rig.lidCase === 0 ? 1 : 0;
    rig.swapping = true;
    return new Promise<void>((resolve) => {
      // The pending wait: for the print, then the timeline's fallback or the reduced-motion beat.
      let cancel = () => {};
      const change: Change = {
        kind,
        phase: 'printing',
        start: 0,
        end: () => {
          if (change.phase === 'ended') return;
          cancel();
          if (change.phase !== 'held') finishSwap(rig, kind);
          change.phase = 'ended';
          if (current === change) current = null;
          resolve();
        },
      };
      // The print returned or the wait ran out, whichever came first; a late print still lands.
      const printed = () => {
        if (change.phase !== 'printing') return;
        cancel();
        // A hidden page draws no frame to play the timeline in: the change is done at once.
        if (disposed || hidden()) {
          change.end();
        } else if (reduced) {
          finishSwap(rig, kind);
          change.phase = 'held';
          cancel = clock.after(REDUCED_MOTION_MS, change.end);
        } else {
          change.phase = 'turning';
          change.start = clock.now();
          // Frames end it; the clock does too, should the page be hidden before they can.
          cancel = clock.after(DURATION[kind] + SETTLE_SLACK_MS, change.end);
        }
      };
      current = change;
      void print(target, to).then(printed);
      // Asked for in a hidden page (the next track of a background tab): done at once, without
      // waiting for its print, which still lands on its disc whenever it can.
      if (hidden()) change.end();
      else cancel = clock.after(PRINT_WAIT_MS, printed);
    });
  };

  return {
    swap,
    print,
    seat: (view) => {
      const loaded = view.status === 'playing' || view.status === 'paused';
      if (!loaded || !view.current || rig.seated !== null || rig.swapping) return;
      rig.seated = rig.lidCase;
      void print(rig.lidCase, view.current);
    },
    frame: (pose) => {
      const change = current;
      if (!change || change.phase === 'held') return false;
      // Its prints are still being painted: the change holds its first pose.
      if (change.phase === 'printing') {
        pose(change.kind, 0);
        return true;
      }
      const t = clock.now() - change.start;
      pose(change.kind, t);
      if (t >= DURATION[change.kind]) change.end();
      return true;
    },
    dispose: () => {
      disposed = true;
      current?.end();
    },
  };
}
