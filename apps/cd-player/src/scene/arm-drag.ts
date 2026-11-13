import type { Status } from '../playback/sequencer';
import { angleDelta } from './controls';
import { grips, type Grips } from './grip';
import { grooveMs, inGrooves, type ToneArm } from './tonearm';

/** What an arm drag reads and moves on the rig (rig.ts's Rig). */
export interface ArmDragRig {
  /** A change is running. */
  swapping: boolean;
  /** The arm's angle the drag holds (about its pivot, from the GLB's pose); null between drags. */
  armDrag: number | null;
  /** The drag's target time (ms) while one goes on, for the LED ring; null between drags. */
  dragMs: number | null;
}

/** What an arm drag reads of the page, and how it seeks. */
export interface ArmDragDeps {
  arm: ToneArm;
  /** The arm's angle now (about its pivot, from the GLB's pose): where a drag starts from. */
  angleNow(): number;
  /** The pointer's angle round the pivot, in the arm's own turn, at (x, y); null off the pivot's plane. */
  pointerAngle(x: number, y: number): number | null;
  /** The bridge's view now. */
  view(): { status: Status; positionMs: number; durationMs: number };
  /** The bridge's relative seek. */
  seek(deltaMs: number): void;
}

/** How far (px) a press goes before it drags: a tap's eased arm is off the position, so no seek. */
export const ARM_DRAG_SLOP_PX = 4;

/** What a drag holds: the arm's angle and the pointer's as it went down, and where it went down. */
interface Hold {
  from: number;
  pointer: number;
  x: number;
  y: number;
  /** It has gone more than ARM_DRAG_SLOP_PX from where it went down (and is a drag for good). */
  moved: boolean;
}

/** The arm takes a drag while a track is loaded, its duration known, and no change runs. */
export function armTakesDrag(
  rig: Pick<ArmDragRig, 'swapping'>,
  view: { status: Status; durationMs: number },
): boolean {
  return (
    !rig.swapping && (view.status === 'playing' || view.status === 'paused') && view.durationMs > 0
  );
}

/**
 * A turntable's arm drags (grip.ts keeps the rules the knob's turn keeps too). While one lasts the
 * arm is lifted and follows the pointer's turn round its pivot, held between the lead-in and the
 * run-out, and `dragMs` is its target: the angle's share of the way in, times the duration. Once
 * the pointer has gone more than ARM_DRAG_SLOP_PX from where it went down, the release seeks once,
 * by the target less the position the view has then (the bridge's seek is relative to the engine's
 * own position), and the arm drops there. A tap's release seeks nothing: the eased arm it lifted
 * is never quite at the reported position, so it ends as a stop does and the arm tracks again. An
 * abandoned drag puts the arm back (the resting pose takes over); a stopped one leaves it where it
 * stands, for the change.
 */
export function armDrags(rig: ArmDragRig, deps: ArmDragDeps): Grips {
  const hold = (angle: number) => {
    const held = inGrooves(deps.arm, angle);
    rig.armDrag = held;
    rig.dragMs = grooveMs(deps.arm, held, deps.view().durationMs);
  };
  const clear = () => {
    rig.armDrag = null;
    rig.dragMs = null;
  };
  return grips<Hold>({
    takes: () => armTakesDrag(rig, deps.view()),
    begin: (x, y) => {
      const pointer = deps.pointerAngle(x, y);
      if (pointer === null) return null;
      const from = deps.angleNow();
      hold(from);
      return { from, pointer, x, y, moved: false };
    },
    move: (held, x, y) => {
      if (Math.hypot(x - held.x, y - held.y) > ARM_DRAG_SLOP_PX) held.moved = true;
      const pointer = deps.pointerAngle(x, y);
      if (pointer !== null) hold(held.from + angleDelta(held.pointer, pointer));
    },
    release: (held) => {
      const target = rig.dragMs;
      clear();
      if (!held.moved || target === null) return;
      const deltaMs = target - deps.view().positionMs;
      if (deltaMs !== 0) deps.seek(deltaMs);
    },
    abandon: clear,
    stop: clear,
  });
}

/**
 * The angle about Y of `point` round `pivot`, both in the pivot's parent's frame, in three's sense
 * of `rotation.y` (+X turns toward -Z): a pointer's turn round the pivot is the arm's.
 */
export function armPointerAngle(
  point: { x: number; z: number },
  pivot: { x: number; z: number },
): number {
  return Math.atan2(-(point.z - pivot.z), point.x - pivot.x);
}
