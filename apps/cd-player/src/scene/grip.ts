import { pinchedSince } from './controls';

/**
 * A control's own maths for a turn or a drag (the knob's relative turn, the tonearm's held angle).
 * The rules every grip keeps are `grips`'.
 */
export interface GripMaths<Hold> {
  /** Whether the control takes a grip now: asked as one begins, and on every event and frame it lasts. */
  takes(): boolean;
  /** A press at (x, y): what the grip holds, or null to begin none. */
  begin(x: number, y: number): Hold | null;
  /** The pointer moved to (x, y). */
  move(hold: Hold, x: number, y: number): void;
  /** A real release: the grip's one seek. */
  release(hold: Hold): void;
  /** Cancelled, its release lost, or become a pinch: everything back as it was, and no seek. */
  abandon(hold: Hold): void;
  /** No longer taken (a change began, a door opened): it ends where it stands, and seeks nothing. */
  stop(hold: Hold): void;
}

/** A control's grips, fed the pointer events that concern them (useGrip.ts feeds the window's). */
export interface Grips {
  /** A press on the control at (x, y), `pinches` pinches begun so far. */
  down(id: number, x: number, y: number, pinches: number): void;
  /** A pointer moves; `lost` says its release was lost (interaction.ts releaseLost). */
  move(id: number, x: number, y: number, pinches: number, lost: boolean): void;
  up(id: number, pinches: number): void;
  cancel(id: number): void;
  /** Every frame: a grip the control no longer takes ends where it stands, with no pointer event. */
  frame(): void;
}

/**
 * The rules a turn of the knob and a drag of the tonearm share: one pointer holds the grip; a
 * cancel, a mouse that lost its release or a touch that became a pinch abandons it; a lift
 * releases it; and a grip the control stops taking (a track that ends mid-turn swaps the very disc
 * it scrubs) stops where it stands, checked on every event and every frame, never only as it begins.
 */
export function grips<Hold>(maths: GripMaths<Hold>): Grips {
  let held: { id: number; pinches: number; hold: Hold } | null = null;

  /** The pointer's grip, if it has one the control still takes (stopping it otherwise). */
  const mine = (id: number) => {
    const grip = held;
    if (!grip || grip.id !== id) return null;
    if (maths.takes()) return grip;
    held = null;
    maths.stop(grip.hold);
    return null;
  };

  return {
    down(id, x, y, pinches) {
      if (!maths.takes()) return;
      const hold = maths.begin(x, y);
      if (hold !== null) held = { id, pinches, hold };
    },
    move(id, x, y, pinches, lost) {
      const grip = mine(id);
      if (!grip) return;
      if (lost || pinchedSince(grip.pinches, pinches)) {
        held = null;
        maths.abandon(grip.hold);
        return;
      }
      maths.move(grip.hold, x, y);
    },
    up(id, pinches) {
      const grip = mine(id);
      if (!grip) return;
      held = null;
      if (pinchedSince(grip.pinches, pinches)) maths.abandon(grip.hold);
      else maths.release(grip.hold);
    },
    cancel(id) {
      const grip = mine(id);
      if (!grip) return;
      held = null;
      maths.abandon(grip.hold);
    },
    frame() {
      if (held) mine(held.id);
    },
  };
}
