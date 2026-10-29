import type { Swapper, TrackView } from '../bridge';
import { DURATION, type SwapKind } from './director';
import { finishSwap, type ChangeState } from './rig';
import type { Painter } from './useDirector';

/** Under reduced motion a change is instant; the music still waits this long for the disc. */
export const REDUCED_MOTION_MS = 300;

export interface SwapClock {
  now(): number;
  /** Calls `done` once after `ms`; the function it returns cancels that. */
  after(ms: number, done: () => void): () => void;
}

export interface SwapControllerOptions {
  rig: ChangeState;
  paint: Painter;
  reduced: boolean;
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
   * Hands the change in progress to `pose` (its kind and the ms into it, 0 while its prints are
   * painted) and ends it once its time is up, after its last pose; false between changes.
   */
  frame(pose: (kind: SwapKind, t: number) => void): boolean;
  /** The scene is going: each change settles now, or as its print returns if it is printing. */
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
 * The disc changes the bridge asks for, as the rules that make each one settle (the engine waits
 * in `swapping` until it does): a new change first ends the one in progress (a collection pasted
 * mid-change, then Play), a print that fails never stops one, and the teardown settles them all.
 * No React and no renderer, on an injected clock, so node tests can drive it; useDirector draws
 * its poses.
 */
export function createSwapController(options: SwapControllerOptions): SwapController {
  const { rig, paint, reduced, clock, onPrintFailed } = options;
  let current: Change | null = null;
  let disposed = false;

  const print = async (index: 0 | 1, view: TrackView): Promise<void> => {
    try {
      await paint(index, view);
    } catch (error) {
      onPrintFailed(error, view);
    }
  };

  const swap: Swapper = (to) => {
    current?.end();
    const kind: SwapKind = rig.seated === null ? 'insert' : 'change';
    const target: 0 | 1 = kind === 'insert' ? rig.lidCase : rig.lidCase === 0 ? 1 : 0;
    rig.swapping = true;
    return new Promise<void>((resolve) => {
      let cancelHold = () => {};
      const change: Change = {
        kind,
        phase: 'printing',
        start: 0,
        end: () => {
          if (change.phase === 'ended') return;
          if (change.phase === 'held') cancelHold();
          else finishSwap(rig, kind);
          change.phase = 'ended';
          if (current === change) current = null;
          resolve();
        },
      };
      current = change;
      void print(target, to).then(() => {
        // Ended meanwhile by a newer change: that one runs now.
        if (change.phase !== 'printing') return;
        if (disposed) {
          change.end();
        } else if (reduced) {
          finishSwap(rig, kind);
          change.phase = 'held';
          cancelHold = clock.after(REDUCED_MOTION_MS, change.end);
        } else {
          change.phase = 'turning';
          change.start = clock.now();
        }
      });
    });
  };

  return {
    swap,
    print,
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
      if (current?.phase !== 'printing') current?.end();
    },
  };
}
