/**
 * The names the page drives in a model's GLB, by the media it plays (`SceneProfile.media` in
 * src/scene/profiles.ts): what every model has, what only a CD player has, what only a turntable
 * has. The Blender builds name them (art/blender/scripts/build_*.py), and
 * src/scene/model-contract.test.ts holds each committed GLB to its kind's.
 */
export type Media = 'cd' | 'vinyl';

/** Every model's: the arm, the six keys and the play key's two icons, the disc and its seat, the plate, the rack. */
export const SHARED_NODES = [
  'arm_pivot',
  'btn_prev',
  'btn_next',
  'btn_play',
  'btn_stop',
  'btn_rpt',
  'btn_mode',
  'icon_play',
  'icon_pause',
  'disc',
  'disc_seat',
  'card',
  'rack_slot_0',
  'rack_slot_1',
  'rack_slot_2',
  'rack_slot_3',
  'rack_slot_4',
] as const;
export type SharedNode = (typeof SHARED_NODES)[number];

/** A CD player's own: its lid (or stand, or flight case), the knob, the jewel case, the tag, the VU strip. */
export const CD_NODES = [
  'lid_hinge',
  'knob',
  'case',
  'case_lid_hinge',
  'case_seat',
  'tag',
  'vu_seg_0',
  'vu_seg_1',
  'vu_seg_2',
  'vu_seg_3',
  'vu_seg_4',
  'vu_seg_5',
  'vu_seg_6',
  'vu_seg_7',
  'vu_seg_8',
  'vu_seg_9',
] as const;
export type CdNode = (typeof CD_NODES)[number];

/**
 * A turntable's own: the platter (it turns under the record), the tonearm's head (a drag's grip),
 * the template sleeve each record's copy clones, and the ledge the playing record's sleeve stands on.
 */
export const VINYL_NODES = ['platter', 'arm_head', 'sleeve', 'sleeve_seat'] as const;
export type VinylNode = (typeof VINYL_NODES)[number];

/** A CD player's contract, as it always was (src/scene/contract.test.ts pins it). */
export const REQUIRED_NODES = [...SHARED_NODES, ...CD_NODES] as const;
export type RequiredNode = (typeof REQUIRED_NODES)[number];

/** A turntable's contract. */
export const TURNTABLE_NODES = [...SHARED_NODES, ...VINYL_NODES] as const;
export type TurntableNode = (typeof TURNTABLE_NODES)[number];

/** The nodes a model of each media must have. */
export const NODES_BY_MEDIA: Readonly<Record<Media, readonly string[]>> = {
  cd: REQUIRED_NODES,
  vinyl: TURNTABLE_NODES,
};

/**
 * Nodes a model may have: the Clear's and the deck's door, the deck's LED ring. The page drives
 * them when they are there (src/scene/profiles.ts names each model's).
 */
export const OPTIONAL_NODES = ['door_hinge', 'jog_ring'] as const;
export type OptionalNode = (typeof OPTIONAL_NODES)[number];

/**
 * Materials a model may have whose maps the page paints at runtime: the deck's LED ring, and the
 * deck's print layer (`deck_pattern`: one atlas over every print zone, src/scene/textures/deck-atlas.json).
 */
export const OPTIONAL_DYNAMIC_MATERIALS = ['jog_ring', 'deck_pattern'] as const;
export type OptionalDynamicMaterial = (typeof OPTIONAL_DYNAMIC_MATERIALS)[number];

/** Printed by every model: the disc's (or the record's) label and the plate. */
export const SHARED_MATERIALS = ['art_disc', 'card_print'] as const;
/** Printed by a CD player only: the booklet, the tag and the display. */
export const CD_MATERIALS = ['art_booklet', 'tag_print', 'lcd_screen'] as const;
/** Printed by a turntable only: the sleeve's cover. */
export const VINYL_MATERIALS = ['art_sleeve'] as const;

/** A CD player's materials whose maps the page paints at runtime (src/scene/textures). */
export const DYNAMIC_MATERIALS = [...SHARED_MATERIALS, ...CD_MATERIALS] as const;
export type DynamicMaterial = (typeof DYNAMIC_MATERIALS)[number];
/** A turntable's. */
export const TURNTABLE_MATERIALS = [...SHARED_MATERIALS, ...VINYL_MATERIALS] as const;
export type TurntableMaterial = (typeof TURNTABLE_MATERIALS)[number];
/** Every printed material of either kind: the loader hands the page each one a GLB has. */
export const PRINTED_MATERIALS = [
  ...SHARED_MATERIALS,
  ...CD_MATERIALS,
  ...VINYL_MATERIALS,
] as const;
export type PrintedMaterial = (typeof PRINTED_MATERIALS)[number];

/** The printed materials a model of each media must have. */
export const MATERIALS_BY_MEDIA: Readonly<Record<Media, readonly PrintedMaterial[]>> = {
  cd: DYNAMIC_MATERIALS,
  vinyl: TURNTABLE_MATERIALS,
};
