import type { ModelId } from '../models';

export type Vec3 = readonly [number, number, number];

/** What the scene needs to know of a model beyond its GLB. */
export interface SceneProfile {
  /**
   * Where the camera looks, from which way, and the half-width (`across`) and half-height (`up`)
   * of what it fits round its aim (metres): a sphere when they are equal.
   */
  frame: { target: Vec3; direction: Vec3; across: number; up: number };
  /** The camera's near plane (metres); absent, framing.ts's NEAR. */
  near?: number;
  /** The arm's angles about its pivot's Y: at rest and over the disc. */
  arm: { rest: number; play: number };
  /**
   * How far the door swings open about its hinge's own axis (radians): Y, unless `axis` says X
   * (the deck's jog plate lifts about its back edge). null: no door.
   */
  door: { angle: number; axis?: 'x' | 'y' } | null;
  /**
   * The glass `lcd_screen` is painted as: the suitcase's and the Clear's segment LCD (absent), or
   * the deck's big screen with its waveform.
   */
  screen?: 'segments' | 'deck';
  /** The disc turns with the knob while a turn lasts: the deck's jog lies over it. */
  knobTurnsDisc?: boolean;
  /**
   * The disc plays clockwise seen from above (vinyl's way), so a forward turn of the deck's jog,
   * which is clockwise, turns it the way it plays. Absent: counter-clockwise, as a CD player's.
   */
  clockwise?: boolean;
  /**
   * A disc's way to and from the spindle (metres, world axes). It leaves a place and reaches the
   * next along each one's normal (the spindle's is its seat's own), the Bézier's handles reaching
   * `reach.slot` out of a rack slot and `reach.spindle` out of the spindle; a disc leaving the
   * spindle goes out of sight at `aside` from its seat, where one from the side comes from too.
   */
  flight: { reach: { slot: number; spindle: number }; aside: Vec3 };
}

const unit = (v: Vec3): Vec3 => {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
};

export const SCENE_PROFILES: Readonly<Record<ModelId, SceneProfile>> = {
  suitcase: {
    frame: {
      target: [0, 0.132, 0.01],
      direction: unit([-0.48, 0.338, 0.79]),
      across: 0.285,
      up: 0.285,
    },
    arm: { rest: 0, play: -0.52 },
    door: null,
    // Out of the lid, past its rim, before it turns down to the deck; out of sight up and to the left.
    flight: { reach: { slot: 0.08, spindle: 0.08 }, aside: [-0.16, 0.06, 0] },
  },
  clear: {
    // Seen from the Clear hero still's camera (Blender's (-255, -880, 400) over its aim
    // (2, 10, 122), in three's axes): front left, above. The set is wide and low, so the camera
    // fits it by its own half-width and half-height, aimed a little left of and below the disc so
    // that the stand, the case and the swinging door all stay in the canvas across the orbit.
    frame: {
      target: [0.01, 0.119, -0.023],
      direction: unit([-0.257, 0.278, 0.89]),
      across: 0.362,
      up: 0.284,
    },
    // The set's near end swings toward the camera under the orbit: a little more depth to the
    // disc's printed layers than the suitcase needs.
    near: 0.52,
    // About the arm pivot's Y: 0 is its rest, off the disc's rim; +0.52 puts the lens under the track.
    arm: { rest: 0, play: 0.52 },
    // The door swings out toward the viewer about its hinge's Y.
    door: { angle: -(100 * Math.PI) / 180 },
    // The stand is beside the shell, its slots 3 to 10 cm behind the shell's front: a disc swings
    // 30 cm out of its slot before it turns in to the door, or it would cut through the shell's side.
    // It comes 10 cm out through the door and goes out of sight up and to the right, clear of the
    // door, which opens to the left (src/scene/rig.test.ts flies every way against the shell).
    flight: { reach: { slot: 0.3, spindle: 0.1 }, aside: [0.1, 0.1, 0.1] },
  },
};
