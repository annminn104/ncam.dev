import type { Side } from '../../../../game/coords';

// The Dark Overlord Court's colours, one per palette slot in SLOTS order (figure/slots.ts): bone,
// silver and violet against black, crimson and gold. The GLBs carry only the slot; a colour
// changes here, never in Blender. It started as a copy of art/blender/dark-court/court.py's DC_W
// and DC_B, which only colour the Blender sheets.
export const DARK_COURT_PALETTE: Record<Side, readonly string[]> = {
  w: [
    '#efe7e6', // skin
    '#dcd6ea', // hair
    '#a77bff', // eyes
    '#e9e4d6', // main
    '#b9c0cc', // second
    '#c4cad6', // trim (silver)
    '#5b3d8f', // accent
    '#241f2e', // ink
    '#b58cff', // glow
    '#ffffff', // white
    '#e3a6c4', // blush
    '#3a2c52', // coat
    '#9b5cff', // gem
    '#4a3a46', // leather
    '#e9e4d6', // fur
    '#d6c2ff', // iris2
    '#5c6270', // lgold
    '#a9a294', // lmain
    '#1c1428', // lcoat
    '#9d97b3', // lhair
    '#cdb8c0', // lskin
    '#e9e4d6', // glove
  ],
  b: [
    '#e4dde0', // skin
    '#e8e6ee', // hair
    '#ff3355', // eyes
    '#121016', // main
    '#2a1f26', // second
    '#d4a64a', // trim (gold)
    '#b3122e', // accent
    '#0a0809', // ink
    '#ff3b4f', // glow
    '#ffffff', // white
    '#e09aa8', // blush
    '#5a0f1f', // coat
    '#ff2a4a', // gem
    '#2e2224', // leather
    '#9a8f82', // fur
    '#ff9aa8', // iris2
    '#4a2a0b', // lgold
    '#3a3036', // lmain
    '#2a0610', // lcoat
    '#a8a3b3', // lhair
    '#c4b4b8', // lskin
    '#1c181c', // glove
  ],
};
