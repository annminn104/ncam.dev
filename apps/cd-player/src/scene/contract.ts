/**
 * The names the page drives in cd-player.glb, set by art/blender/scripts/build_player.py.
 * src/scene/model-contract.test.ts checks the committed GLB against them.
 */
export const REQUIRED_NODES = [
  'lid_hinge',
  'arm_pivot',
  'knob',
  'btn_prev',
  'btn_next',
  'btn_play',
  'btn_stop',
  'btn_rpt',
  'btn_mode',
  'icon_play',
  'icon_pause',
  'disc',
  'case',
  'case_lid_hinge',
  'card',
  'tag',
  'disc_seat',
  'case_seat',
  'rack_slot_0',
  'rack_slot_1',
  'rack_slot_2',
  'rack_slot_3',
  'rack_slot_4',
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
export type RequiredNode = (typeof REQUIRED_NODES)[number];

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

/** Materials whose maps the page paints at runtime (src/scene/textures). */
export const DYNAMIC_MATERIALS = [
  'art_disc',
  'art_booklet',
  'card_print',
  'tag_print',
  'lcd_screen',
] as const;
export type DynamicMaterial = (typeof DYNAMIC_MATERIALS)[number];
