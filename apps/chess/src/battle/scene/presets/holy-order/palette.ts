import type { Side } from '../../../../game/coords';

// Holy Order's colours, one per palette slot in SLOTS order (figure/slots.ts): white and gold
// clergy against black and crimson. The GLBs carry only the slot; a colour changes here, never in
// Blender. It started as a copy of art/blender/kit.py's PAL_W and PAL_B, which only colour the
// Blender previews.
export const HOLY_ORDER_PALETTE: Record<Side, readonly string[]> = {
  w: [
    '#ffe6d6', // skin
    '#f3e4bd', // hair
    '#5a8fd6', // eyes
    '#f4f6fb', // main
    '#dfe6f0', // second
    '#d6b25e', // trim (gold)
    '#3e5fbf', // accent
    '#2a2d3a', // ink
    '#e6fff6', // glow
    '#ffffff', // white
    '#f4a6a6', // blush
    '#2b3a6e', // coat
    '#1fc8a8', // gem
    '#7a4a2a', // leather
    '#fbfbf6', // fur
    '#9cc8ff', // iris2
    '#6a3c10', // lgold
    '#a6b0cb', // lmain
    '#121a38', // lcoat
    '#bba25f', // lhair
    '#dc9c86', // lskin
    '#f7f8fc', // glove
  ],
  b: [
    '#f5d9c8', // skin
    '#f2f4f8', // hair
    '#c8283c', // eyes
    '#1c1d24', // main
    '#2b2d38', // second
    '#c9a24e', // trim (gold)
    '#b0233a', // accent
    '#0d0d12', // ink
    '#ffd27a', // glow
    '#ffffff', // white
    '#e89a9a', // blush
    '#561524', // coat
    '#ff3b52', // gem
    '#3a2a24', // leather
    '#2c2b31', // fur
    '#ff9a9a', // iris2
    '#4a2a0b', // lgold
    '#444859', // lmain
    '#26060e', // lcoat
    '#a3a9bd', // lhair
    '#d2917d', // lskin
    '#2a2b33', // glove
  ],
};
