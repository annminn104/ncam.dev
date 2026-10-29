/**
 * What each Blender material becomes in three (src/scene/materials.ts). The GLB carries the base
 * colour, roughness and metalness tuned in Blender; the role adds what glTF cannot say (sheen,
 * grain, transmission, iridescence). Three-free so the contract test can read it.
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
  | 'screen';

export const MATERIAL_ROLES: Readonly<Record<string, MaterialRole>> = {
  leather: 'leather',
  fabric: 'fabric',
  lining: 'lining',
  deck: 'plastic',
  grille: 'plastic',
  btn: 'plastic',
  arm: 'plastic',
  well: 'plastic',
  pin_blue: 'plastic',
  pin_pink: 'plastic',
  paper: 'matte',
  thread: 'matte',
  ink: 'matte',
  ink_dark: 'matte',
  rubber: 'matte',
  lcd_ghost: 'matte',
  crystal: 'crystal',
  polycarbonate: 'crystal',
  gold: 'metal',
  chrome: 'metal',
  alu_side: 'metal',
  alu: 'brushed',
  disc_metal: 'disc-data',
  foil: 'foil',
  hub_black: 'gloss-black',
  black_glass: 'gloss-black',
  led: 'emissive',
  lcd: 'emissive',
  art_disc: 'print',
  art_booklet: 'print',
  art_photo_a: 'print',
  art_photo_b: 'print',
  card_print: 'print',
  lcd_screen: 'screen',
};
