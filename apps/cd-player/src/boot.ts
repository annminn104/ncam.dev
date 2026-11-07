// The page's phases: waiting until the scene starts (by itself on a hardware GPU, see
// src/autoplay.ts, else when the visitor presses "Open the player" or a music control), the scene
// booting behind the loader, the live scene, or a failure over the backdrop. Pure, so node tests can
// walk every path; the boot's stall watch below runs on an injected clock for the same reason.
import type { Failure } from './failure';

export type Phase = 'waiting' | 'booting' | 'live' | 'error';

export interface BootState {
  phase: Phase;
  /** What failed, for the visitor; set only in `error`. */
  failure: Failure | null;
}

export type BootEvent =
  /** The "Open the player" button; also "Try again", for a failure that can be retried in place. */
  | { type: 'start' }
  /**
   * The scene starts unasked: the page settled on a device that may open it by itself, or the
   * visitor used a music control (play, next, previous, a track). From `waiting` only, so it never
   * retries a failure.
   */
  | { type: 'autostart' }
  /** The scene's first frames are on screen. */
  | { type: 'ready' }
  | { type: 'fail'; failure: Failure };

export const INITIAL_BOOT: BootState = { phase: 'waiting', failure: null };

export function bootReducer(state: BootState, event: BootEvent): BootState {
  switch (event.type) {
    case 'start':
      return state.phase === 'waiting' || (state.phase === 'error' && state.failure?.retry)
        ? { phase: 'booting', failure: null }
        : state;
    case 'autostart':
      return state.phase === 'waiting' ? { phase: 'booting', failure: null } : state;
    case 'ready':
      return state.phase === 'booting' ? { phase: 'live', failure: null } : state;
    case 'fail':
      return state.phase === 'booting' || state.phase === 'live'
        ? { phase: 'error', failure: event.failure }
        : state;
  }
}

/**
 * How long a boot may go without a word, waiting on the scene's code, on the model's download and
 * then on its parse and compile, before it fails as stalled; a change of model once one is on show
 * gets as long (src/scene/model-load.ts).
 */
export const BOOT_STALL_MS = 20_000;

/** The stall watch's timer: `after` calls `done` once after `ms`, and returns its canceller. */
export interface StallClock {
  after(ms: number, done: () => void): () => void;
}

/** The page's own timers, which the watches run on outside the tests. */
export const PAGE_TIMERS: StallClock = {
  after: (ms, done) => {
    const id = setTimeout(done, ms);
    return () => clearTimeout(id);
  },
};

/**
 * What a load that went quiet was waiting on: the scene's code until the model's download first
 * reports (the download begins once the code has come), the download while it comes, and the
 * model's parse and its shaders' compile once it has ended.
 */
export type StallPart = 'scene' | 'model' | 'compile';

export interface StallWatch {
  /**
   * A progress event of the model's download (src/scene/model.ts downloadModel): null as its
   * request goes out and while its size is unknown, a fraction as it comes, 1 at its end.
   */
  progress(fraction: number | null): void;
  /**
   * The watch ends: the model has taken the stage (its first frames are all that is left, and a
   * hidden page draws none), or the load is over otherwise (failed, let go, the phase left).
   */
  stop(): void;
}

/**
 * A stall watch, so no spinner runs for ever: `onStall` runs once when a load goes `ms` without a
 * word, with the part it was waiting on. Armed as the load starts (waiting on `from`: the boot's
 * on the scene's code, a change's on its download), armed again by every progress event (a
 * fraction or null alike), and over only with `stop`. It times silence, never the load as a whole,
 * so a slow download is not a stalled one; but the parse and the compile after the download's end
 * (the 1 that only the end of its stream reports) say nothing, so together they must land within
 * `ms` of it. An event after that end is a new download's (a model chosen while the one before
 * parsed and compiled), watched as the first was. The scene's code says nothing as it comes, so it
 * alone must come whole within `ms`.
 */
export function watchStall(
  onStall: (part: StallPart) => void,
  clock: StallClock,
  ms: number = BOOT_STALL_MS,
  from: StallPart = 'scene',
): StallWatch {
  let cancel: (() => void) | null = null;
  let part = from;
  const arm = () => {
    cancel?.();
    cancel = clock.after(ms, () => {
      cancel = null;
      onStall(part);
    });
  };
  const stop = () => {
    cancel?.();
    cancel = null;
  };
  arm();
  return {
    progress(fraction) {
      // Stopped or stalled already: nothing arms it again.
      if (!cancel) return;
      part = fraction !== null && fraction >= 1 ? 'compile' : 'model';
      arm();
    },
    stop,
  };
}
