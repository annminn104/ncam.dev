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
 * How long a boot may go without a word, waiting on the scene's code and then on the model's
 * download, before it fails as stalled.
 */
export const BOOT_STALL_MS = 20_000;

/** The stall watch's timer: `after` calls `done` once after `ms`, and returns its canceller. */
export interface StallClock {
  after(ms: number, done: () => void): () => void;
}

/**
 * What a boot that went quiet was waiting on: the scene's code until the model's download first
 * reports (the download begins once the code has come), the download from then on.
 */
export type StallPart = 'scene' | 'model';

export interface StallWatch {
  /**
   * A progress event of the model's download (src/scene/model.ts downloadModel): null as its
   * request goes out and while its size is unknown, a fraction as it comes, 1 at its end.
   */
  progress(fraction: number | null): void;
  /** The boot has left `booting` (live, failed or let go): the watch ends. */
  stop(): void;
}

/**
 * The boot's stall watch, so the loader never spins for ever: `onStall` runs once when the boot
 * goes `ms` without a word, with the part it was waiting on. Armed as the boot starts, armed again
 * by every progress event (a fraction or null alike), and over once the download is complete (the
 * 1 that only the end of its stream reports) or with `stop`. It times silence, never the boot as a
 * whole: the shaders compile after the download without a word (seconds on a software
 * rasteriser), and a slow machine is not a stalled one. The scene's code says nothing as it comes,
 * so it alone must come whole within `ms`.
 */
export function watchStall(
  onStall: (part: StallPart) => void,
  clock: StallClock,
  ms: number = BOOT_STALL_MS,
): StallWatch {
  let cancel: (() => void) | null = null;
  // Nothing has reported yet: the boot waits on the scene's code.
  let part: StallPart = 'scene';
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
      // Stopped, complete or stalled already: nothing arms it again.
      if (!cancel) return;
      part = 'model';
      if (fraction !== null && fraction >= 1) stop();
      else arm();
    },
    stop,
  };
}
