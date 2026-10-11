// The palette slots a figure's vertices carry (_SLOT), in the order art/blender/kit.py numbers
// them: the contract between the Blender scripts, the GLBs and the palettes. Append only.
export const SLOTS = [
  'skin',
  'hair',
  'eyes',
  'main',
  'second',
  'trim',
  'accent',
  'ink',
  'glow',
  'white',
  'blush',
  'coat',
  'gem',
  'leather',
  'fur',
  'iris2',
  'lgold',
  'lmain',
  'lcoat',
  'lhair',
  'lskin',
  'glove',
] as const;

export type Slot = (typeof SLOTS)[number];

/** Slots the paint shader treats apart: gold takes the metal ramp, glow is unlit, gems sparkle. */
export const SLOT_GOLD = SLOTS.indexOf('trim');
export const SLOT_GLOW = SLOTS.indexOf('glow');
export const SLOT_GEM = SLOTS.indexOf('gem');

/** The widest outline a part may have: a GLB stores each width as a byte, width / LINE_MAX. */
export const LINE_MAX = 0.008;
