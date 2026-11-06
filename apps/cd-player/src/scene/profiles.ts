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
  /** How far the door swings open about its hinge's Y (radians); null: no door. */
  door: { angle: number } | null;
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
  },
};
