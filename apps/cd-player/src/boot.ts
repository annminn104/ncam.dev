// The page's phases: the poster until the scene starts (by itself on a hardware GPU, see
// src/autoplay.ts, else on the visitor's first interaction), the scene booting over it, the live
// scene, or a failure over the poster. Pure, so node tests can walk every path.
import type { Failure } from './failure';

export type Phase = 'poster' | 'booting' | 'live' | 'error';

export interface BootState {
  phase: Phase;
  /** What failed, for the visitor; set only in `error`. */
  failure: Failure | null;
}

export type BootEvent =
  /** The Enter button, or a pointer or wheel on the poster; also "Try again". */
  | { type: 'start' }
  /** The page settled on a device that may start the scene unasked; from the poster only. */
  | { type: 'autostart' }
  /** The scene's first frames are on screen. */
  | { type: 'ready' }
  | { type: 'fail'; failure: Failure };

export const INITIAL_BOOT: BootState = { phase: 'poster', failure: null };

export function bootReducer(state: BootState, event: BootEvent): BootState {
  switch (event.type) {
    case 'start':
      return state.phase === 'poster' || (state.phase === 'error' && state.failure?.retry)
        ? { phase: 'booting', failure: null }
        : state;
    case 'autostart':
      return state.phase === 'poster' ? { phase: 'booting', failure: null } : state;
    case 'ready':
      return state.phase === 'booting' ? { phase: 'live', failure: null } : state;
    case 'fail':
      return state.phase === 'booting' || state.phase === 'live'
        ? { phase: 'error', failure: event.failure }
        : state;
  }
}
