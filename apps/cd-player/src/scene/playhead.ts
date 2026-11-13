import type { SceneView } from '../bridge';

/**
 * How long the page carries the position on by itself past the embed's last report (ms): its
 * progress events come in steps, and a stalled embed must not run the arm on to the label.
 */
export const PLAYHEAD_HOLD_MS = 2000;

/** What the playhead reads of the bridge's view. */
export type PlayheadView = Pick<SceneView, 'current' | 'status' | 'positionMs' | 'durationMs'>;

export interface Playhead {
  /** The position at `nowMs` (performance.now()): the last report, carried on while it plays. */
  read(view: PlayheadView, nowMs: number): number;
}

/**
 * The position between the embed's progress events, frame by frame, so a turntable's arm and its
 * LED ring move smoothly: from the last report, carried on in real time while the track plays (at
 * most PLAYHEAD_HOLD_MS), held at the duration. A new report, a new track or a new status anchors
 * it again; anything but playing holds the report. Three-free.
 */
export function createPlayhead(): Playhead {
  let anchor: {
    id: string | null;
    status: PlayheadView['status'];
    positionMs: number;
    at: number;
  } | null = null;
  return {
    read(view, nowMs) {
      const id = view.current?.id ?? null;
      if (
        !anchor ||
        anchor.id !== id ||
        anchor.status !== view.status ||
        anchor.positionMs !== view.positionMs
      ) {
        anchor = { id, status: view.status, positionMs: view.positionMs, at: nowMs };
      }
      const run =
        view.status === 'playing' ? Math.min(Math.max(0, nowMs - anchor.at), PLAYHEAD_HOLD_MS) : 0;
      const at = view.positionMs + run;
      return view.durationMs > 0 ? Math.min(view.durationMs, at) : at;
    },
  };
}
