// The page's phases: the poster until the engine starts (by itself on a hardware GPU, see
// src/autoplay.ts, else on the visitor's first interaction), the engine booting over it, the live
// scene — or an error over the poster. Pure, so node tests can walk every path.

export type Phase = 'poster' | 'booting' | 'live' | 'error';

/** A shortcut that needs the engine. Pressed before it runs, it waits in `queued`. */
export type EngineKey = 'cruise' | 'door';

export interface BootState {
  phase: Phase;
  /** What failed, in words for the visitor; set only in `error`. */
  error: string | null;
  /** Shortcuts pressed before the engine ran, applied in order once it is live. */
  queued: EngineKey[];
}

export type BootEvent =
  /** A boot trigger: the Enter button, a pointer or wheel on the poster, O or C. */
  | { type: 'start' }
  /** The page settled on a device that may start the engine unasked; from the poster only. */
  | { type: 'autostart' }
  /** The engine's first frame is on screen. */
  | { type: 'ready' }
  | { type: 'fail'; message: string }
  | { type: 'queue'; key: EngineKey }
  /** The queued shortcuts were applied. */
  | { type: 'drain' };

export const INITIAL_BOOT: BootState = { phase: 'poster', error: null, queued: [] };

export function bootReducer(state: BootState, event: BootEvent): BootState {
  switch (event.type) {
    case 'start':
      return state.phase === 'poster' || state.phase === 'error'
        ? { ...state, phase: 'booting', error: null }
        : state;
    case 'autostart':
      return state.phase === 'poster' ? { ...state, phase: 'booting' } : state;
    case 'ready':
      return state.phase === 'booting' ? { ...state, phase: 'live' } : state;
    case 'fail':
      return state.phase === 'booting'
        ? { phase: 'error', error: event.message, queued: [] }
        : state;
    case 'queue':
      return state.phase === 'poster' || state.phase === 'booting'
        ? { ...state, queued: [...state.queued, event.key] }
        : state;
    case 'drain':
      return state.queued.length > 0 ? { ...state, queued: [] } : state;
  }
}

export const GENERIC_FAILURE = "The 3D scene couldn't start. Please try again.";

/**
 * What to tell the visitor. A GLError (src/engine/gl.ts) already speaks plainly — no WebGL2, a
 * shader the device refused — and logs its technical detail to the console itself; anything else
 * (a chunk that would not load, a bug) gets the generic line.
 */
export function failureMessage(error: unknown): string {
  return error instanceof Error && error.name === 'GLError' && error.message
    ? error.message
    : GENERIC_FAILURE;
}
