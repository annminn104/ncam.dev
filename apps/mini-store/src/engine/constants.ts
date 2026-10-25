// Brand / palette constants shared by the atlas, the materials and the models.
export const CK_RED = '#e4211b';
export const CK_ORG = '#f7941d';
export const XSM = '#12bfcf'; // Xanh SM cyan
export const GRAB = '#00b14f'; // Grab green
export const PACK = [
  '#e8402f',
  '#f2b705',
  '#2a7de1',
  '#1fa35a',
  '#f07c1b',
  '#d93a8c',
  '#ffffff',
  '#7a3fc0',
  '#13a3b5',
  '#c8102e',
  '#ffd23f',
  '#3d5afe',
  '#ff6f61',
  '#00a676',
  '#f4f1de',
  '#e94f37',
  '#393e41',
  '#44bba4',
] as const;

/** diorama base half-size: geometry outside |x|,|z| > EDGE is clipped in the shaders */
export const EDGE = 8.07;
export const MAXL = 40; // point lights per frame
export const MAXS = 4; // shadowed spot lights
