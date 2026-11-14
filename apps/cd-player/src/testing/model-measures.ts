/**
 * What the scene's tests know of the committed GLBs (public/assets/cd-player.glb and
 * cd-player-clear.glb, cd-player-deck.glb and cd-player-luxe.glb), in three's Y-up metres, as three's GLTFLoader loads them:
 * src/scene/framing.test.ts frames each model's box and sweeps the Clear's door, and
 * src/scene/rig.test.ts poses the Clear's seat and stand and flies its discs past its shell's walls
 * (the Deck's and Luxe's are read the same way).
 * src/scene/model-contract.test.ts holds the GLBs to every number here, so a rebuild that moves one
 * fails it: measure it again then (that test's helpers do), and change it here.
 */

type Vec3 = readonly [number, number, number];

/**
 * Each model's box: the whole GLB at rest with a 120 mm disc in each of the five rack slots, which
 * the page puts there (they lie within the lid's or the stand's own extent), rounded out to the
 * millimetre. The suitcase's is the player, lid open, centred at x = 0; the Clear's is the player,
 * its plinth, handle and knob, the stand, the jewel case and its easel; the Deck's is the deck, its
 * jewel case on the right, and the flight case (turned 18°) whose rack its discs wait in; Luxe's is
 * the turntable, its arm at rest, its ledge and its stand, with a record and its sleeve in each slot.
 */
export const BOXES = {
  suitcase: { min: [-0.152, -0.003, -0.199], max: [0.152, 0.319, 0.152] },
  clear: { min: [-0.316, -0.001, -0.09], max: [0.333, 0.279, 0.069] },
  deck: { min: [-0.161, -0.001, -0.225], max: [0.417, 0.282, 0.224] },
  luxe: { min: [-0.226, -0.001, -0.292], max: [0.596, 0.379, 0.191] },
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

/**
 * The Deck's jog plate (`door_hinge`, carrying `knob`): its hinge, which turns about the world's X
 * (the page lifts it with a negative turn, -90°, to upright) and stands at the well's back edge, 76 mm
 * up, and the box of its parts shut.
 */
export const DECK_DOOR = {
  hinge: [0.03, 0.076, -0.097],
  axis: 'x',
  shut: { min: [-0.07594, 0.07585, -0.09594], max: [0.13594, 0.09232, 0.11594] },
} as const satisfies { hinge: Vec3; axis: 'x'; shut: { min: Vec3; max: Vec3 } };

/**
 * The Deck's spindle seat (`disc_seat`, where its `disc` lies too): at the well's centre, 65.6 mm
 * up, the disc flat on the hub, its normal the world's up.
 */
export const DECK_SEAT = {
  position: [0.03, 0.0656, 0.01],
  up: [0, 1, 0],
} as const satisfies { position: Vec3; up: Vec3 };

/**
 * The Deck's rack slot `k` (`rack_slot_k`, in the flight case's own frame): each 14 mm above and
 * 18 mm behind the one below it, every one turned a quarter about X so a disc stands up in it.
 */
export function deckSlot(k: number): { position: Vec3; rotationX: number } {
  return { position: [0, 0.112 + 0.014 * k, 0.04 - 0.018 * k], rotationX: Math.PI / 2 };
}

/**
 * The Deck's chassis: the box of the deck body alone. That is the `deck` node's meshes but for the
 * jog plate, the flight case, the jewel case with all that sits on it, and the screen module
 * (DECK_SCREEN), so the housing with its keys, pads, knobs, fader, ports, arm, spindle and disc
 * (the disc lies in the well, which the flight test lets a disc enter).
 */
export const DECK_CHASSIS = {
  min: [-0.16015, 0, -0.1894],
  max: [0.16015, 0.0881, 0.18095],
} as const satisfies { min: Vec3; max: Vec3 };

/**
 * The Deck's screen module, standing at the back of the top: its housing (from 68 mm, inside the
 * body, up to 192 mm) and the bezel, glass and VU strip in its face, as one box.
 */
export const DECK_SCREEN = {
  min: [-0.1, 0.06807, -0.18083],
  max: [0.1, 0.19209, -0.13503],
} as const satisfies { min: Vec3; max: Vec3 };

/**
 * The Deck's jog well, a cylinder pocket in the top: its centre at the middle of its floor, 107 mm
 * out to the wall, the floor 61 mm up.
 */
export const DECK_WELL = {
  centre: [0.03, 0.061, 0.01],
  radius: 0.107,
  floor: 0.061,
} as const satisfies { centre: Vec3; radius: number; floor: number };

/**
 * The Deck's flight case (`lid_hinge`, which never moves): its box in its own frame, the rack
 * slots' frame, and its turn about Y, 18° toward the deck, in the world's.
 */
export const DECK_CASE = {
  min: [-0.092, 0, -0.1656],
  max: [0.092, 0.2815, 0.1045],
  turn: (-18 * Math.PI) / 180,
} as const satisfies { min: Vec3; max: Vec3; turn: number };

/** Luxe's record seat (`disc_seat`, where its `disc` lies too): on the platter's mat, its up the world's. */
export const LUXE_SEAT = {
  position: [-0.045, 0.1017, -0.01],
  up: [0, 1, 0],
} as const satisfies { position: Vec3; up: Vec3 };

/** A record (vinyl.py): 300 mm across, a 100 mm label 0.1 mm clear of the vinyl, 1.8 mm thick. */
export const LUXE_RECORD = { radius: 0.15, label: 0.05, labelLift: 0.0001, half: 0.0009 } as const;

/** A sleeve (vinyl.py): 310 mm square. */
export const LUXE_SLEEVE = { half: 0.155 } as const;

/** Luxe's platter (`platter`): its spindle's foot, its radius to the rim, its bottom and its mat's top. */
export const LUXE_PLATTER = {
  centre: [-0.045, 0.084, -0.01],
  radius: 0.15585,
  bottom: 0.084,
  top: 0.1008,
} as const satisfies { centre: Vec3; radius: number; bottom: number; top: number };

/**
 * Luxe's plinth (`luxe_deck_body`): the tiers, bands, frame, feet, keys, LED ring, logo, ornament
 * and the dancer's pedestal, whose top is its highest point.
 */
export const LUXE_PLINTH = {
  min: [-0.2258, 0, -0.1908],
  max: [0.2258, 0.1, 0.1908],
} as const satisfies { min: Vec3; max: Vec3 };

/**
 * Luxe's dancer (`dancer`, the empty the page turns, its up the world's) on her pedestal at the
 * deck's back left corner: where it stands, and the box of the pedestal, the turning disc and the
 * figure swept a full turn about its vertical axis (a cylinder's box: her reach from the axis,
 * 31.98 mm, all round), in the GLB's world frame at rest.
 */
export const LUXE_DANCER = {
  position: [-0.188, 0.1, -0.153],
  min: [-0.21998, 0.08, -0.18498],
  max: [-0.15602, 0.207, -0.12102],
} as const satisfies { position: Vec3; min: Vec3; max: Vec3 };

/**
 * Luxe's tonearm: its pivot, the box of the arm and its fixed base at rest (on its rest post), and
 * its turns about the pivot's Y onto the lead-in groove and the run-out (luxe_arm.py's, printed by
 * build_luxe.py; src/scene/profiles.ts's luxe profile carries the same two). The box is of what
 * is drawn: the head's invisible hit shape (`arm_hit`, 52 × 40 × 26 mm round the head, which
 * reaches 5 mm further left and 11 mm further forward) stops no record or sleeve.
 */
export const LUXE_ARM = {
  pivot: [0.15, 0.118, -0.11],
  rest: { min: [0.122, 0.08, -0.16506], max: [0.18501, 0.134, 0.13149] },
  leadIn: -0.3905,
  runOut: -0.7865,
} as const satisfies {
  pivot: Vec3;
  rest: { min: Vec3; max: Vec3 };
  leadIn: number;
  runOut: number;
};

/** Where the needle stands from the spindle at the lead-in and at the run-out (m). */
export const LUXE_GROOVES = { leadIn: 0.146, runOut: 0.06 } as const;

/**
 * Luxe's record stand (`luxe_stand`), right of the deck and square to it, facing the viewer: a
 * record and its sleeve leave a slot along its face, toward the viewer, never into the plinth.
 */
export const LUXE_STAND = {
  position: [0.42, 0, -0.06],
  rotationY: 0,
} as const satisfies { position: Vec3; rotationY: number };

/**
 * Luxe's rack slot `k` (`rack_slot_k`, in the stand's own frame): each 12 mm above and 34 mm
 * behind the one before it, every sleeve leaning back 15°.
 */
export function luxeSlot(k: number): { position: Vec3; rotationX: number } {
  return { position: [0, 0.1802 + 0.012 * k, 0.0439 - 0.034 * k], rotationX: (75 * Math.PI) / 180 };
}

type Box = { min: Vec3; max: Vec3 };

/** The stand's steps (`luxe_stand_step_k`), in its own frame: a staircase rising toward its back. */
export const LUXE_STEPS: readonly Box[] = [0, 1, 2, 3, 4].map((k): Box => ({
  min: [-0.165, 0, k === 4 ? -0.105 : 0.051 - 0.034 * k],
  max: [0.165, 0.03 + 0.012 * k, 0.085 - 0.034 * k],
}));

/**
 * The stand's side panels (`luxe_stand_panel_l`, `_r`), in its own frame: low (60 mm at the front,
 * 100 mm at the back), 10 mm beside a sleeve.
 */
export const LUXE_PANELS: readonly [Box, Box] = [
  { min: [-0.175, -0.0003, -0.10537], max: [-0.165, 0.10046, 0.08529] },
  { min: [0.165, -0.0003, -0.10537], max: [0.175, 0.10046, 0.08529] },
];

/** The stand's back bar (`luxe_stand_bar`), in its own frame, which slot 4's sleeve leans on. */
export const LUXE_BAR: Box = { min: [-0.176, 0.206, -0.097], max: [0.176, 0.214, -0.089] };

/**
 * Luxe's ledge behind the deck, behind the platter (its bar 14 mm behind the plinth, its sleeve's
 * ends within the deck's width): the playing record's sleeve seat (`sleeve_seat`, where the
 * template `sleeve` stands too), and the easel's bar, lip and legs, in world space.
 */
export const LUXE_LEDGE = {
  seat: { position: [-0.045, 0.1582, -0.2497], rotationX: (75 * Math.PI) / 180 },
  bar: { min: [-0.145, 0, -0.229], max: [0.055, 0.008, -0.205] },
  lip: { min: [-0.145, 0.008, -0.208], max: [0.055, 0.012, -0.205] },
  legs: [
    { min: [-0.12749, 0.00535, -0.28073], max: [-0.12251, 0.24865, -0.21104] },
    { min: [0.03251, 0.00535, -0.28073], max: [0.03749, 0.24865, -0.21104] },
  ],
} as const satisfies {
  seat: { position: Vec3; rotationX: number };
  bar: Box;
  lip: Box;
  legs: readonly [Box, Box];
};
