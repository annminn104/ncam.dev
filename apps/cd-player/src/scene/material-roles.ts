import type { ClearPart } from '../clear-looks';
import type { DeckPart } from '../deck-looks';
import type { SkinRole } from '../skins';

/**
 * What each Blender material becomes in three (src/scene/materials.ts). The GLB carries the base
 * colour, roughness and metalness tuned in Blender; the role adds what glTF cannot say (sheen,
 * grain, quilting, weave, transmission, iridescence). Three-free so the contract test can read it.
 */
export type MaterialRole =
  | 'leather'
  | 'fabric'
  | 'lining'
  | 'plastic'
  | 'matte'
  | 'crystal'
  | 'metal'
  | 'brushed'
  | 'disc-data'
  | 'foil'
  | 'gloss-black'
  | 'emissive'
  | 'print'
  | 'screen'
  | 'clear-shell'
  | 'frame'
  | 'pcb'
  | 'etch'
  | 'gold'
  | 'decal'
  | 'lacquer'
  | 'hit';

export const MATERIAL_ROLES: Readonly<Record<string, MaterialRole>> = {
  leather: 'leather',
  trim: 'leather',
  fabric: 'fabric',
  strap: 'fabric',
  lining: 'lining',
  deck: 'plastic',
  grille: 'plastic',
  btn: 'plastic',
  arm: 'plastic',
  well: 'plastic',
  thread: 'matte',
  ink: 'matte',
  ink_dark: 'matte',
  rubber: 'matte',
  lcd_ghost: 'matte',
  crystal: 'crystal',
  polycarbonate: 'crystal',
  hardware: 'metal',
  chrome: 'metal',
  alu_side: 'metal',
  alu: 'brushed',
  disc_metal: 'disc-data',
  foil: 'foil',
  hub_black: 'gloss-black',
  black_glass: 'gloss-black',
  led: 'emissive',
  lcd: 'emissive',
  vu: 'emissive',
  art_disc: 'print',
  art_booklet: 'print',
  card_print: 'print',
  tag_print: 'print',
  lcd_screen: 'screen',
  jog_ring: 'screen',
  clear_shell: 'clear-shell',
  door_glass: 'crystal',
  clear_frame: 'frame',
  board: 'pcb',
  light: 'emissive',
  chip: 'gloss-black',
  copper: 'metal',
  flex: 'matte',
  silk: 'matte',
  solder: 'metal',
  cell: 'plastic',
  magnet: 'metal',
  surround: 'matte',
  wire_red: 'matte',
  trace: 'pcb',
  etch: 'etch',
  gold: 'gold',
  deck_body: 'frame',
  deck_light: 'emissive',
  jog_acrylic: 'crystal',
  foam: 'matte',
  deck_pattern: 'decal',
  rca_red: 'plastic',
  rca_white: 'plastic',
  luxe_body: 'lacquer',
  luxe_metal: 'frame',
  luxe_light: 'emissive',
  vinyl: 'gloss-black',
  platter_mat: 'matte',
  strobe: 'matte',
  cartridge: 'plastic',
  sleeve_paper: 'matte',
  arm_hit: 'hit',
  art_sleeve: 'print',
};

/**
 * GLB material name → the skin role that colours it (src/skins.ts). One material per role:
 * `hardware` is every metal fitting (the caps, clasps, rivets, D-rings, nameplate, grille frame,
 * feet, hinges, bezel and the tonearm's metal), `trim` the piping, the handle, the tag and the
 * rack's frame.
 */
export const SKIN_ROLES: Readonly<Record<string, SkinRole>> = {
  leather: 'leather',
  trim: 'trim',
  thread: 'thread',
  lining: 'lining',
  hardware: 'hardware',
  deck: 'deck',
  grille: 'grille',
};

/** GLB material name → the Clear model's part that colours it (src/clear-looks.ts). */
export const CLEAR_ROLES: Readonly<Record<string, ClearPart>> = {
  clear_shell: 'shell',
  clear_frame: 'frame',
  board: 'board',
  light: 'light',
};

/** GLB material name → the Deck's part that colours it (src/deck-looks.ts). */
export const DECK_ROLES: Readonly<Record<string, DeckPart>> = {
  deck_body: 'body',
  deck_light: 'light',
};
