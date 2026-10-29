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
  'disc',
  'case',
  'case_lid_hinge',
  'polaroid_a',
  'polaroid_b',
  'card',
  'disc_seat',
  'case_seat',
] as const;
export type RequiredNode = (typeof REQUIRED_NODES)[number];

/** Materials whose maps the page paints at runtime (src/scene/textures). */
export const DYNAMIC_MATERIALS = [
  'art_disc',
  'art_booklet',
  'art_photo_a',
  'art_photo_b',
  'card_print',
  'lcd_screen',
] as const;
export type DynamicMaterial = (typeof DYNAMIC_MATERIALS)[number];
