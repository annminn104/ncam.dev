// The page's phases: waiting until the scene starts (by itself on a hardware GPU, see
// src/autoplay.ts, else when the visitor presses "Open the player" or a music control), the scene
// booting behind the loader, the live scene, or a failure over the backdrop. Pure, so node tests can
// walk every path.
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
