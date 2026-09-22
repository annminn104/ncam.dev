export interface ShowcaseValue {
  x: number;
  y: number;
}

export interface Showcase {
  start: (nowMs: number) => void;
  /** Synthetic pointer position for this moment, or the centre when inactive. */
  valueAt: (nowMs: number) => ShowcaseValue;
  cancel: () => void;
  isActive: () => boolean;
}

export interface ShowcaseOptions {
  durationMs: number;
  /** false under reduced motion; the showcase then never runs. */
  enabled?: boolean;
}

/**
 * The one-shot intro sweep. A pure state machine over a clock the caller
 * supplies, so it can be tested without a browser: `valueAt` is a function of
 * elapsed time, and the only mutable state is whether it is running.
 *
 * It ends where it started, at the centre, so handing control back to the
 * pointer spring is seamless.
 */
export function createShowcase({ durationMs, enabled = true }: ShowcaseOptions): Showcase {
  let startedAt: number | null = null;
  let cancelled = false;

  const isActive = () => startedAt !== null && !cancelled;

  return {
    isActive,
    start(nowMs) {
      if (!enabled || cancelled || startedAt !== null) return;
      startedAt = nowMs;
    },
    cancel() {
      cancelled = true;
      startedAt = null;
    },
    valueAt(nowMs) {
      if (!isActive()) return { x: 0, y: 0 };
      const elapsed = nowMs - (startedAt as number);
      if (elapsed >= durationMs) {
        cancelled = true;
        return { x: 0, y: 0 };
      }
      const t = elapsed / durationMs;
      // One full sweep, eased at both ends so it starts and stops gently.
      const envelope = Math.sin(Math.PI * t);
      return {
        x: Math.sin(t * Math.PI * 2) * envelope,
        y: Math.sin(t * Math.PI * 2 + Math.PI / 3) * envelope * 0.5,
      };
    },
  };
}
