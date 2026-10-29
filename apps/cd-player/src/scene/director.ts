/**
 * The CD change as pure functions of time (ms), so node tests can walk it. The rig turns a pose
 * into transforms (src/scene/rig.ts).
 *
 * insert (nothing on the spindle yet, about 1.1 s): the case in the lid opens, its disc flies
 *   down onto the spindle, the case closes, the tonearm swings in and lowers.
 * change (about 2.8 s): the arm lifts and swings to its rest; the disc rises and flies back into
 *   the lid's case, which opens and closes on it; that case slides out, the next track's case
 *   slides in, opens, and its disc flies down; the arm swings in and lowers.
 */
export type SwapKind = 'insert' | 'change';

/** The tonearm's angle about its pivot (three's Y): over the disc, and at its rest. */
export const ARM_PLAY = -0.52;
export const ARM_REST = 0;

export const DURATION: Readonly<Record<SwapKind, number>> = { insert: 1100, change: 2800 };

/** `along`: 0 seated on the spindle … 1 inside its case. `rise`: lift above the path, 0 … 1. */
export interface DiscPose {
  along: number;
  rise: number;
}

/** `slide`: -1 gone left, 0 in the lid, 1 waiting right. `open`: the case's lid, 0 … 1. */
export interface CasePose {
  slide: number;
  open: number;
}

export interface Pose {
  armAngle: number;
  armLift: number;
  /** Disc spin, as a share of full speed. */
  spin: number;
  /** The disc going home and its case (change only). */
  oldDisc: DiscPose | null;
  oldCase: CasePose | null;
  /** The disc being seated and its case. */
  newDisc: DiscPose | null;
  newCase: CasePose;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
/** 0 before `a`, eased to 1 at `b`. */
const span = (t: number, a: number, b: number) => ease((t - a) / (b - a));
/** 0 → 1 → 0 between `a` and `b`. */
const bump = (t: number, a: number, b: number) => Math.sin(Math.PI * clamp01((t - a) / (b - a)));

export function swapPose(kind: SwapKind, tMs: number): Pose {
  const t = Math.min(Math.max(tMs, 0), DURATION[kind]);
  if (kind === 'insert') {
    return {
      armAngle: ARM_REST + (ARM_PLAY - ARM_REST) * span(t, 700, 1050),
      armLift: 1 - span(t, 950, 1100),
      spin: span(t, 900, 1100),
      oldDisc: null,
      oldCase: null,
      newDisc: { along: 1 - span(t, 120, 720), rise: bump(t, 120, 720) },
      newCase: { slide: 0, open: span(t, 0, 180) - span(t, 650, 850) },
    };
  }
  const away = span(t, 0, 400);
  const back = span(t, 2400, 2750);
  const oldAlong = span(t, 900, 1300);
  return {
    armAngle: ARM_PLAY + (ARM_REST - ARM_PLAY) * away + (ARM_PLAY - ARM_REST) * back,
    armLift: Math.max(bump(t, 0, 500), bump(t, 2350, 2800)),
    spin: 1 - span(t, 0, 400) + span(t, 2600, 2800),
    oldDisc: t < 1900 ? { along: oldAlong, rise: span(t, 400, 900) * (1 - oldAlong) } : null,
    oldCase:
      t < 1900
        ? { slide: -span(t, 1500, 1900), open: span(t, 850, 1000) - span(t, 1250, 1450) }
        : null,
    newDisc: { along: 1 - span(t, 2000, 2350), rise: bump(t, 2000, 2350) },
    newCase: { slide: 1 - span(t, 1500, 1900), open: span(t, 1900, 2050) - span(t, 2250, 2400) },
  };
}

/**
 * Between changes: the disc on the spindle (or still in the lid's case before the first play), the
 * arm on the disc while a track is loaded, the disc spinning while it plays.
 */
export function restingPose(seated: boolean, onDisc: boolean, playing: boolean): Pose {
  return {
    armAngle: seated && onDisc ? ARM_PLAY : ARM_REST,
    armLift: 0,
    spin: seated && playing ? 1 : 0,
    oldDisc: null,
    oldCase: null,
    newDisc: { along: seated ? 0 : 1, rise: 0 },
    newCase: { slide: 0, open: 0 },
  };
}
