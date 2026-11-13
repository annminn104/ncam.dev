import type { ModelId } from '../models';
import type { Media } from './contract';

export type Vec3 = readonly [number, number, number];

/** What the scene needs to know of a model beyond its GLB. */
export interface SceneProfile {
  /**
   * What the model plays: CDs, or records (a turntable). Its GLB is held to that kind's node
   * contract (src/scene/contract.ts), and the scene mounts that kind's parts (PlayerRig.tsx).
   */
  media: Media;
  /** How fast the disc turns while it plays (turns a minute): a CD player's 200, a record's 33⅓. */
  rpm: number;
  /**
   * Where the camera looks, from which way, and the half-width (`across`) and half-height (`up`)
   * of what it fits round its aim (metres): a sphere when they are equal.
   */
  frame: { target: Vec3; direction: Vec3; across: number; up: number };
  /** The camera's near plane (metres); absent, framing.ts's NEAR. */
  near?: number;
  /**
   * The arm's angles about its pivot's Y: at rest and over the disc. A turntable's `play` is the
   * lead-in (the needle over the record's outer groove) and `runOut` the needle by the label; the
   * arm tracks between them as the track plays (src/scene/tonearm.ts).
   */
  arm: { rest: number; play: number; runOut?: number };
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
  flight: {
    reach: { slot: number; spindle: number };
    aside: Vec3;
    /**
     * Which way a disc leaves and reaches a rack slot: along the slot's own normal, the disc's
     * face ('normal', the default: right for the suitcase's lid and the Clear's stand, which open
     * toward it), or along the world's up ('up'). A crate's discs stand in foam slots facing its
     * front, so the face is the way into the foam and the front wall; they lift out of the crate.
     */
    exit?: 'normal' | 'up';
  };
}

const unit = (v: Vec3): Vec3 => {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
};

export const SCENE_PROFILES: Readonly<Record<ModelId, SceneProfile>> = {
  suitcase: {
    media: 'cd',
    rpm: 200,
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
    media: 'cd',
    rpm: 200,
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
  deck: {
    media: 'cd',
    rpm: 200,
    // Seen from the Deck hero still's camera (Blender's (-320, -900, 480) over its aim (60, 0, 80),
    // in three's axes): front left, above. The set (the deck and the flight case right of it) is
    // wide and low: the camera fits it by its own half-width and half-height. It aims at the set's
    // middle (x 0.128, 0.42 of its height) a little in front of the box's middle (z 0.05), toward
    // the jewel case: from there the orbit's ends keep the whole set 1 % inside the canvas.
    frame: {
      target: [0.128, 0.115, 0.05],
      direction: unit([-0.38, 0.4, 0.9]),
      across: 0.44,
      up: 0.36,
    },
    // The set is deep (0.45 m) as well as wide: the foil's depth steps (rig test: six or more, even on
    // a narrow canvas where the camera stands far back) need this near plane, and the orbit's worst
    // corner still stands 0.2 m past it.
    near: 0.82,
    // About the arm pivot's Y: 0 is its rest beside the disc; play puts the head over the outer
    // tracks (deck.py's DECK_ARM_PLAY, 50°).
    arm: { rest: 0, play: (50 * Math.PI) / 180 },
    // The jog plate lifts about its back edge (the hinge's X), front up: a negative turn, to upright.
    // Leaning forward over the well (the 70° of the first fit) it stands in the way of every disc
    // that comes down into the well from the crate on the right; upright, its front face is 4 cm
    // behind the disc's rim, and clear of the screen module (src/scene/rig.test.ts).
    door: { angle: -(90 * Math.PI) / 180, axis: 'x' },
    // A disc stands in its foam slot facing the crate's front, so it lifts straight out ('up'), 30 cm
    // of handle, and the same going in; it turns flat on the way over to the deck, and comes down
    // into the well from 15 cm above it. Out of sight it goes up, to the right and toward the viewer.
    // Every way is flown against the crate, the deck, its screen and the lifted plate in
    // src/scene/rig.test.ts.
    flight: { reach: { slot: 0.3, spindle: 0.15 }, aside: [0.1, 0.1, 0.1], exit: 'up' },
    knobTurnsDisc: true,
    clockwise: true,
    // The big 16:9 screen instead of the segment LCD.
    screen: 'deck',
  },
};
