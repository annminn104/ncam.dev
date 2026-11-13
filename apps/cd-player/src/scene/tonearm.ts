import { ARM_PLAY, ARM_REST } from './director';
import type { SceneProfile } from './profiles';

/**
 * A turntable's tonearm, as angles about its pivot's Y from the GLB's pose (radians): on its rest
 * post, over the record's lead-in groove, and over the run-out by the label. Three-free.
 */
export interface ToneArm {
  rest: number;
  leadIn: number;
  runOut: number;
}

/** A turntable profile's arm; none for a CD player. A turntable without its run-out is a mistake. */
export function toneArmOf(profile: Pick<SceneProfile, 'media' | 'arm'>): ToneArm | null {
  if (profile.media !== 'vinyl') return null;
  const { rest, play, runOut } = profile.arm;
  if (runOut === undefined) throw new Error('a turntable’s arm needs its run-out angle');
  return { rest, leadIn: play, runOut };
}

/** How far into its track the needle is: position over duration, 0 … 1; 0 without a duration. */
export function grooveShare(positionMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return 0;
  return Math.min(1, Math.max(0, positionMs / durationMs));
}

/** The arm's angle a share of the way from the lead-in to the run-out. */
export function grooveAngle(arm: ToneArm, share: number): number {
  return arm.leadIn + (arm.runOut - arm.leadIn) * share;
}

/** `angle` held between the lead-in and the run-out, whichever way round they lie. */
export function inGrooves(arm: ToneArm, angle: number): number {
  const low = Math.min(arm.leadIn, arm.runOut);
  const high = Math.max(arm.leadIn, arm.runOut);
  return Math.min(high, Math.max(low, angle));
}

/** The time (whole ms) the needle drops at for an arm held at `angle`: its share of the duration. */
export function grooveMs(arm: ToneArm, angle: number, durationMs: number): number {
  // Held to [0, 1] here too: at the lead-in the quotient is -0, and Math.max gives +0.
  const share = Math.min(
    1,
    Math.max(0, (inGrooves(arm, angle) - arm.leadIn) / (arm.runOut - arm.leadIn)),
  );
  return Math.round(share * Math.max(0, durationMs));
}

/**
 * A model angle in the director's units (ARM_REST at the rest, ARM_PLAY at the lead-in, past it
 * beyond): rig.ts's armAngleFor turned back, so a pose can carry a groove's angle.
 */
export function directorAngle(arm: ToneArm, angle: number): number {
  return ARM_REST + ((angle - arm.rest) / (arm.leadIn - arm.rest)) * (ARM_PLAY - ARM_REST);
}
