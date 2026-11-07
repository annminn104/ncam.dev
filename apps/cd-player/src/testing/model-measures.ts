/**
 * What the scene's tests know of the committed GLBs (public/assets/cd-player.glb and
 * cd-player-clear.glb), in three's Y-up metres, as three's GLTFLoader loads them:
 * src/scene/framing.test.ts frames each model's box and sweeps the Clear's door, and
 * src/scene/rig.test.ts poses the Clear's seat and stand and flies its discs past its shell's walls.
 * src/scene/model-contract.test.ts holds the GLBs to every number here, so a rebuild that moves one
 * fails it: measure it again then (that test's helpers do), and change it here.
 */

type Vec3 = readonly [number, number, number];

/**
 * Each model's box: the whole GLB at rest with a 120 mm disc in each of the five rack slots, which
 * the page puts there (they lie within the lid's or the stand's own extent), rounded out to the
 * millimetre. The suitcase's is the player, lid open, centred at x = 0; the Clear's is the player,
 * its plinth, handle and knob, the stand, the jewel case and its easel.
 */
export const BOXES = {
  suitcase: { min: [-0.152, -0.003, -0.199], max: [0.152, 0.319, 0.152] },
  clear: { min: [-0.316, -0.001, -0.09], max: [0.333, 0.279, 0.069] },
} as const satisfies Record<string, { min: Vec3; max: Vec3 }>;

/**
 * The Clear's door (`door_hinge`): its hinge, which turns about the world's Y and stands 0.1501 m
 * up, and the box of its parts shut.
 */
export const CLEAR_DOOR = {
  hinge: [-0.079, 0.1501, 0.0405],
  min: [-0.082, 0.0751, 0.0375],
  max: [0.0798, 0.2251, 0.0435],
} as const satisfies { hinge: Vec3; min: Vec3; max: Vec3 };

/** The Clear's spindle seat (`disc_seat`, where its `disc` stands too): upright, its normal +z. */
export const CLEAR_SEAT = {
  position: [0, 0.1501, 0.024],
  rotationX: Math.PI / 2,
} as const satisfies { position: Vec3; rotationX: number };

/** The Clear's stand (`lid_hinge`), right of the shell and turned 18° toward it. */
export const CLEAR_STAND = {
  position: [0.252, 0, -0.012],
  rotationY: (-18 * Math.PI) / 180,
} as const satisfies { position: Vec3; rotationY: number };

/**
 * The Clear's rack slot `k` (`rack_slot_k`, in the stand's own frame): each 20 mm above and 18 mm
 * behind the one below it, every one leaning back 15°.
 */
export function clearSlot(k: number): { position: Vec3; rotationX: number } {
  return { position: [0, 0.0655 + 0.02 * k, 0.0194 - 0.018 * k], rotationX: (75 * Math.PI) / 180 };
}

/**
 * The Clear shell's walls: its outline 300 × 214 mm with 20 mm corners from 30.1 mm up, the front
 * plate from z 35 to 38 mm but for the opening the disc passes through (64 mm round the window's
 * middle), the back plate from -38 to -35 mm, and the 3 mm band round the sides, the top and the
 * bottom between them.
 */
export const CLEAR_SHELL = {
  halfWidth: 0.15,
  bottom: 0.0301,
  top: 0.2441,
  corner: 0.02,
  band: 0.003,
  front: [0.035, 0.038],
  back: [-0.038, -0.035],
  opening: { y: 0.1501, radius: 0.064 },
} as const;
