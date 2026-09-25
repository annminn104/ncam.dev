import type { ClipShape } from './select';

/** Insets as fractions of the card, matching the reference's CSS percentages. */
export interface RegionRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * A box cut out of a region: every point with x0 ≤ x < x1 and y0 ≤ y < y1,
 * as fractions of the card from its top-left. Corners, not insets.
 */
export interface CutBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The frame a card is printed in, as far as its foil's clip cares: where the
 * art window sits, and what the frame lays over it. select.ts's `layoutOf`
 * reads it off the card's set, or its rarity for the three frames a rarity
 * brings (LV.X, Prime, LEGEND). `other` is every card no measured layout
 * claims — Scarlet & Violet, Mega, Pocket — and keeps the clip every card had
 * before the layouts: the reference's.
 */
export type CardLayout =
  | 'wotc'
  | 'e-card'
  | 'ex'
  | 'dp'
  | 'dp-sp'
  | 'lv-x'
  | 'hgss'
  | 'prime'
  | 'legend'
  | 'bw-xy'
  | 'sm'
  | 'swsh'
  | 'other';

/** How many boxes one region can cut: the shader's uCutA and uCutB. */
export const MAX_CUTS = 2;

/** The regions no layout changes: the trainer's, the border's, the whole card. */
const REGIONS: Record<Exclude<ClipShape, 'regular' | 'stage'>, RegionRect> = {
  // --clip-trainer: inset(14.5% 8.5% 48.2% 8.5%)
  trainer: { top: 0.145, right: 0.085, bottom: 0.482, left: 0.085 },
  // --clip-borders: inset(2.8% 4% round 2.55% / 1.5%), less the rounding
  borders: { top: 0.028, right: 0.04, bottom: 0.028, left: 0.04 },
  full: { top: 0, right: 0, bottom: 0, left: 0 },
};

/** pokemon-cards-css's --clip: inset(9.85% 8% 52.85% 8%), a Sword & Shield card's art. */
const REFERENCE_ART: RegionRect = { top: 0.0985, right: 0.08, bottom: 0.5285, left: 0.08 };

interface LayoutClip {
  /** The art window: the region of both `regular` and `stage`. */
  art: RegionRect;
  /** What the frame lays over the art on any card but an evolution. */
  regular: readonly CutBox[];
  /** What it lays over the art on a Stage 1 or 2: the "evolves from" box. */
  stage: readonly CutBox[];
}

const box = (x0: number, y0: number, x1: number, y1: number): CutBox => ({ x0, y0, x1, y1 });

/**
 * Each frame's art window and what it prints over it. Measured 2026-09-25 off
 * TCGdex's high-res scans, headless: per layout, the edge maps of 3 to 12
 * holo Pokémon cards averaged into one picture (the frame, which has its
 * edges in the same place on every card, stands out; the art averages away),
 * the peaks read off its row and column profiles, and every edge checked by
 * eye on a 1% grid over the zoomed corners of real cards. A rect is the art's
 * own edge, to about half a percent. A box takes whole what it covers,
 * slanted ends and round corners included, so the foil never shines on a
 * banner — at the price of a sliver of art beside one.
 *
 * `swsh` keeps the reference's --clip, which its art measures within a
 * percent of, and cuts the reference's --clip-stage polygon (91.5% 9.85%, 57%
 * 9.85%, 54% 12%, 17% 12%, 16% 14%, 12% 16%, 8% 16% …) as two boxes, the
 * banner and the picture. One box, x < 57% by y < 16%, stood in for both
 * until then and took the art between them too; `other`, unmeasured, keeps
 * it.
 */
const LAYOUTS: Readonly<Record<CardLayout, LayoutClip>> = {
  // Base to Neo, and Legendary Collection. An evolution's badge, a star or a
  // disc holding its pre-evolution, sits over the art's top-left corner.
  wotc: {
    art: { top: 0.114, right: 0.105, bottom: 0.49, left: 0.108 },
    regular: [],
    stage: [box(0, 0, 0.21, 0.17)],
  },
  // Expedition, Aquapolis and Skyridge. The art runs almost to the card's
  // right edge; its left corners are round, and the rect foils the frame in
  // them. An evolution's disc sits above the art.
  'e-card': {
    art: { top: 0.123, right: 0.037, bottom: 0.515, left: 0.1 },
    regular: [],
    stage: [],
  },
  // The EX sets. An evolution's disc sits at the art's bottom left, half over it.
  ex: {
    art: { top: 0.099, right: 0.078, bottom: 0.53, left: 0.077 },
    regular: [],
    stage: [box(0, 0.44, 0.18, 1)],
  },
  // Diamond & Pearl and Platinum. A Basic's BASIC banner crosses the art's
  // top left; an evolution's banner is longer, and its disc hangs below it.
  dp: {
    art: { top: 0.092, right: 0.07, bottom: 0.497, left: 0.068 },
    regular: [box(0, 0, 0.245, 0.123)],
    stage: [box(0, 0, 0.57, 0.125), box(0, 0, 0.19, 0.165)],
  },
  // Platinum's SP Pokémon, all Basic: a wider window, the BASIC banner, and
  // the owner's portrait over the art's bottom right.
  'dp-sp': {
    art: { top: 0.09, right: 0.06, bottom: 0.497, left: 0.058 },
    regular: [box(0, 0, 0.245, 0.12), box(0.78, 0.43, 1, 1)],
    stage: [box(0, 0, 0.245, 0.12), box(0.78, 0.43, 1, 1)],
  },
  // A LV.X: the LEVEL-UP banner over the art's top. Its stage is LEVEL-UP,
  // never Stage 1 or 2, so its `stage` is never used and only mirrors `regular`.
  'lv-x': {
    art: { top: 0.09, right: 0.067, bottom: 0.49, left: 0.065 },
    regular: [box(0, 0, 0.57, 0.124)],
    stage: [box(0, 0, 0.57, 0.124)],
  },
  // HeartGold & SoulSilver and Call of Legends: a wide window, with the
  // banners along its top edge — the evolution's picture sits above the art.
  hgss: {
    art: { top: 0.087, right: 0.047, bottom: 0.482, left: 0.048 },
    regular: [box(0, 0, 0.24, 0.108)],
    stage: [box(0, 0, 0.555, 0.111)],
  },
  // An HGSS Prime: a taller window, and the same banners.
  prime: {
    art: { top: 0.098, right: 0.055, bottom: 0.478, left: 0.05 },
    regular: [box(0, 0, 0.21, 0.106)],
    stage: [box(0, 0, 0.53, 0.113)],
  },
  // A LEGEND half: its art is the whole card, so the foil keeps to the border.
  legend: {
    art: REGIONS.borders,
    regular: [],
    stage: [],
  },
  // Black & White and XY, one frame: an evolution's disc, and the thin
  // "evolves from" band under the name.
  'bw-xy': {
    art: { top: 0.098, right: 0.094, bottom: 0.501, left: 0.085 },
    regular: [],
    stage: [box(0, 0, 0.58, 0.113), box(0, 0, 0.19, 0.16)],
  },
  // Sun & Moon: an evolution's octagon, and its band.
  sm: {
    art: { top: 0.083, right: 0.058, bottom: 0.527, left: 0.057 },
    regular: [],
    stage: [box(0, 0, 0.56, 0.107), box(0, 0, 0.135, 0.165)],
  },
  swsh: {
    art: REFERENCE_ART,
    regular: [],
    stage: [box(0, 0, 0.555, 0.12), box(0, 0, 0.16, 0.16)],
  },
  other: {
    art: REFERENCE_ART,
    regular: [],
    stage: [box(0, 0, 0.57, 0.16)],
  },
};

/** Whether a shape's region is the art window, and so its layout's. */
function isArtWindow(shape: ClipShape): shape is 'regular' | 'stage' {
  return shape === 'regular' || shape === 'stage';
}

/**
 * The inset rect a shape confines the foil to. `regular` and `stage` are the
 * art window of the card's layout; the others are the same on every card.
 */
export function regionFor(shape: ClipShape, layout: CardLayout = 'other'): RegionRect {
  return isArtWindow(shape) ? LAYOUTS[layout].art : REGIONS[shape];
}

/** The boxes cut out of that rect: what the layout's frame prints over the art. */
export function cutsFor(shape: ClipShape, layout: CardLayout = 'other'): readonly CutBox[] {
  return isArtWindow(shape) ? LAYOUTS[layout][shape] : [];
}

/**
 * Whether the foil covers this point. `x` and `y` are fractions of the card
 * from its top-left. The GLSL coverage() in shader/base.ts computes the same
 * thing from the same numbers, which the scene hands it as uniforms — this is
 * its testable twin.
 */
export function coversPoint(
  shape: ClipShape,
  x: number,
  y: number,
  invert: boolean,
  layout: CardLayout = 'other',
): boolean {
  const r = regionFor(shape, layout);
  let inside = x >= r.left && x <= 1 - r.right && y >= r.top && y <= 1 - r.bottom;
  if (inside && cutsFor(shape, layout).some((c) => x >= c.x0 && x < c.x1 && y >= c.y0 && y < c.y1))
    inside = false;
  return invert ? !inside : inside;
}
