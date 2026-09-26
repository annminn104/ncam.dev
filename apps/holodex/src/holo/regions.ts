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
 * reads it off the card's set, or its rarity for the frames a rarity brings
 * (LV.X, Prime, LEGEND and the illustration rares' full art), or its name for
 * the ex frame of Scarlet & Violet, Mega and Pocket. `other` is every card no measured layout claims
 * (Pokémon Rumble, the energies, the sets without card art) and keeps the
 * clip every card had before the layouts: the reference's.
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
  | 'sv'
  | 'pocket'
  | 'modern-ex'
  | 'sv-illustration'
  | 'pocket-illustration'
  | 'sv-special-illustration'
  | 'sv-hyper'
  | 'sv-hyper-ex'
  | 'sv-ultra'
  | 'sv-ultra-ex'
  | 'swsh-ultra'
  | 'swsh-ultra-v'
  | 'swsh-gallery-v'
  | 'swsh-gallery-vmax'
  | 'swsh-galarian-trainer'
  | 'full-card'
  | 'other';

/** How many boxes one region can cut: the shader's uCutA, uCutB and uCutC. */
export const MAX_CUTS = 3;

/**
 * The regions of the shapes that are not the art window: the trainer's,
 * which a layout may measure for itself (LayoutClip's `trainer`), and the
 * border's and the whole card's, the same on every card.
 */
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
  /** A trainer's art window, where measured; the reference's --clip-trainer otherwise. */
  trainer?: RegionRect;
  /** What the frame lays over a trainer's window, where measured. */
  trainerCuts?: readonly CutBox[];
}

const box = (x0: number, y0: number, x1: number, y1: number): CutBox => ({ x0, y0, x1, y1 });

/**
 * A Sword & Shield V's dark bars, the full art's and the gallery's alike:
 * its weakness, resistance and retreat bar, and the V rule box below it,
 * which runs into the black at the card's bottom right.
 */
const SWSH_V_BARS: readonly CutBox[] = [box(0.04, 0.857, 1, 0.89), box(0.375, 0.905, 1, 0.965)];

/**
 * A Sword & Shield full-art Supporter's rule box, the orange one at its
 * bottom right ("You may play only 1 Supporter card during your turn").
 */
const SWSH_SUPPORTER_RULE = box(0.338, 0.876, 0.972, 0.966);

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
  // Scarlet & Violet and Mega, one frame (30th Celebration's too). The art
  // sits within half a percent of the reference's --clip, which pokemon-
  // cards-151 kept for these cards; an evolution's round picture and its
  // "evolves from" band sit over the art's top-left, both much smaller than
  // the reference's --clip-stage cut. A trainer's window is measured too, the
  // reverse foils reaching the Items and Supporters of these sets.
  sv: {
    art: { top: 0.097, right: 0.075, bottom: 0.528, left: 0.078 },
    regular: [],
    stage: [box(0, 0, 0.66, 0.123), box(0, 0, 0.18, 0.185)],
    trainer: { top: 0.138, right: 0.077, bottom: 0.48, left: 0.08 },
  },
  // Pokémon TCG Pocket: the same window, and an evolution's octagon.
  pocket: {
    art: { top: 0.097, right: 0.075, bottom: 0.528, left: 0.078 },
    regular: [],
    stage: [box(0, 0, 0.57, 0.118), box(0, 0, 0.16, 0.175)],
  },
  // The ex of Scarlet & Violet, Mega and Pocket, Tera and Mega ex included:
  // the illustration runs border to border down to the silver bar over the
  // text. ex-regular inverts it (select.ts): its reference foils the card but
  // its Pokémon with a per-card mask, and the card less its art matched two
  // thirds of those masks, where the art alone matched a fifth.
  'modern-ex': {
    art: { top: 0.028, right: 0.04, bottom: 0.505, left: 0.038 },
    regular: [],
    stage: [],
  },
  // An Illustration rare of Scarlet & Violet or Mega: the illustration fills
  // the card inside its silver border, and the frame prints its stage tab
  // over the top-left, an evolution's round picture below the tab and its
  // "evolves from" band beside the picture. pokemon-cards-151 clips it to the
  // border polygon, which leaves out the tab, and the per-card masks it draws
  // 151's sixteen with, their foil layers, leave out the picture and the band
  // as well, on every one of them (2026-09-25).
  'sv-illustration': {
    art: { top: 0.028, right: 0.04, bottom: 0.027, left: 0.038 },
    regular: [box(0, 0, 0.17, 0.064)],
    stage: [box(0, 0, 0.185, 0.19), box(0.15, 0.095, 0.675, 0.12)],
  },
  // A Pocket One Star, the same full art: its patterned border, its tab, an
  // evolution's octagon and band.
  'pocket-illustration': {
    art: { top: 0.033, right: 0.04, bottom: 0.03, left: 0.042 },
    regular: [box(0, 0, 0.165, 0.083)],
    stage: [box(0, 0, 0.17, 0.17), box(0.15, 0.093, 0.6, 0.12)],
  },
  // A Special illustration rare, ex or Supporter: the reference has no
  // clip-path for it, only its per-card masks, and on all seven of 151's they
  // foil the whole card, border, tab, band and rule box included, all but
  // the figure and, on an evolution, the pre-evolution's picture inside its
  // ring (2026-09-25). The picture is the one part a box can take.
  'sv-special-illustration': {
    art: { top: 0, right: 0, bottom: 0, left: 0 },
    regular: [],
    stage: [box(0.035, 0.07, 0.163, 0.18)],
    trainer: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  // A Scarlet & Violet Hyper rare, the gold card, trainer or energy: the whole
  // card, but a trainer's rule box, the silver-blue one over its gold at the
  // bottom (an Item's, a Tool's or a Stadium's, the tallest). The reference
  // has no clip-path, only its per-card masks, and 151's three foil the
  // border and nearly all the gold, but leave out the rule box: 3% of it on
  // Switch took foil (2026-09-25).
  'sv-hyper': {
    art: { top: 0, right: 0, bottom: 0, left: 0 },
    regular: [],
    stage: [],
    trainer: { top: 0, right: 0, bottom: 0, left: 0 },
    trainerCuts: [box(0.335, 0.875, 0.975, 0.968)],
  },
  // A Scarlet & Violet Hyper rare Pokémon, always an ex: the whole card but
  // its silver "Pokémon ex rule" box (17% of it foiled on Mew ex's mask).
  'sv-hyper-ex': {
    art: { top: 0, right: 0, bottom: 0, left: 0 },
    regular: [box(0.36, 0.892, 0.975, 0.958)],
    stage: [box(0.36, 0.892, 0.975, 0.958)],
  },
  // A Scarlet & Violet or Mega Ultra Rare, the full-art ex or trainer: the
  // whole card, but a trainer's rule box, and on an evolution the
  // pre-evolution's picture, where the special illustration rare's frame has
  // it. The reference has no clip-path, only its per-card masks, and all
  // sixteen of 151's (#182 to #197, 2026-09-25) foil the border, the tab and
  // the band, but leave out the picture (25% of it foiled) and the rule box
  // (4% of a Supporter's). A Mega's rule box is gold, where an SV one's is
  // silver, and is cut the same, as the same frame's box: no mask shows it.
  'sv-ultra': {
    art: { top: 0, right: 0, bottom: 0, left: 0 },
    regular: [],
    stage: [box(0.035, 0.07, 0.163, 0.18)],
    trainer: { top: 0, right: 0, bottom: 0, left: 0 },
    trainerCuts: [box(0.335, 0.875, 0.975, 0.968)],
  },
  // An Ultra Rare Pokémon, always an ex: the same, but its "Pokémon ex rule"
  // box (27% of it foiled on the masks), where a Hyper rare ex has its own.
  'sv-ultra-ex': {
    art: { top: 0, right: 0, bottom: 0, left: 0 },
    regular: [box(0.36, 0.892, 0.975, 0.958)],
    stage: [box(0.36, 0.892, 0.975, 0.958), box(0.035, 0.07, 0.163, 0.18)],
  },
  // A Sword & Shield Ultra Rare, the full-art V or Supporter. The older
  // reference has no clip-path for either, only its per-card masks, which
  // keep their foil in alpha, and its six V full arts' (Mew, Scizor, Unown,
  // Celebi, Giratina and Origin Forme Dialga V) foil the whole card, the
  // border included, but leave out the frame's dark bars (2026-09-25), as
  // `swsh-ultra-v` cuts. A Supporter's leave out its silver TRAINER header
  // and its orange rule box instead: 94% and 92.5% of them bare on all 81
  // Sword & Shield full-art Supporters' masks, where a foiled part is about
  // half bare, its etching's lines (2026-09-26). So do the Trainer Gallery's
  // (95% and 93% on its 16 Ultra Rare Supporters and its six Full Art
  // Trainers), which take this frame too; the Galarian Gallery's foil the
  // header (`swsh-galarian-trainer`). The black V drawn over a V's top-left
  // is left out as well, but it is a triangle whose silver outlines take
  // foil, and a color-dodged shine leaves black black.
  'swsh-ultra': {
    art: { top: 0, right: 0, bottom: 0, left: 0 },
    regular: [],
    stage: [],
    trainer: { top: 0, right: 0, bottom: 0, left: 0 },
    trainerCuts: [box(0.025, 0.023, 0.975, 0.068), SWSH_SUPPORTER_RULE],
  },
  // A V's: its bars (89% and 86% bare). A Galarian Gallery V, whose silver
  // border its masks foil too, takes this frame as well (87% and 85% bare on
  // all nine, 2026-09-26).
  'swsh-ultra-v': {
    art: { top: 0, right: 0, bottom: 0, left: 0 },
    regular: SWSH_V_BARS,
    stage: SWSH_V_BARS,
  },
  // A Trainer Gallery V (swsh9tg to swsh12tg), a full-art V inside a black
  // border: the card inside that border, less the same bars. The masks of all
  // 29 (2026-09-26) leave out the border (96% to 100% of it bare), the
  // weakness bar and the V rule box (96% and 98%); the border's inner edge,
  // measured off TCGdex's scans, is the reference's --clip-borders inset
  // (2.8% 4%) to 0.15%. The border is not quite black (about 6 in 255), which
  // a color-dodged shine would lift towards grey. The black strip its HP and
  // type are printed on, beside the name, is left out too (100% bare), and
  // cut from the name bar's round end (70.5% across, on TCGdex's scans) down
  // to the art's top edge (9.5%). The black V over the top-left is left out
  // as well, but it is a triangle, and stays.
  'swsh-gallery-v': {
    art: { top: 0.028, right: 0.04, bottom: 0.028, left: 0.04 },
    regular: [...SWSH_V_BARS, box(0.705, 0, 1, 0.095)],
    stage: [...SWSH_V_BARS, box(0.705, 0, 1, 0.095)],
  },
  // A gallery VMAX, a Trainer Gallery's (swsh9tg to swsh12tg) or the
  // Galarian Gallery's: the whole card, less its header and the same bars.
  // The masks of all 18 (2026-09-26) foil the border, which on a VMAX is no
  // black one, but leave out the header's silver panels, the VMAX mark over
  // the picture of the V it evolves from (97% bare on the 15 Trainer Gallery
  // masks) and the bands that name that V and its Dynamax (92%), and the
  // weakness bar and the VMAX rule box, silver where a V's is black (96% and
  // 98%). The header's box takes those panels whole, as TCGdex's scans have
  // them (the bands' slanted ends at 58%, the picture's frame down to 16%),
  // with the corner above them and the start of the name beside them, which
  // the masks leave out too. The Galarian Gallery's three masks foil its
  // bands, but the box still suits them best of those tried.
  'swsh-gallery-vmax': {
    art: { top: 0, right: 0, bottom: 0, left: 0 },
    regular: [box(0, 0, 0.58, 0.16), ...SWSH_V_BARS],
    stage: [box(0, 0, 0.58, 0.16), ...SWSH_V_BARS],
  },
  // A Galarian Gallery Supporter (swsh12.5gg's ten, all Ultra Rare): the
  // whole card less its rule box. Its header is the same silver TRAINER bar
  // as every Sword & Shield full-art Supporter's, but its masks foil it (46%
  // bare on all ten, 2026-09-26, the etched half of a foiled part and its
  // letters) where theirs leave it out, and leave out the rule box as theirs
  // do (93.5%): cutting the header too matched them on 69.3% of the frame,
  // the rule box alone on 71.8%.
  'swsh-galarian-trainer': {
    art: { top: 0, right: 0, bottom: 0, left: 0 },
    regular: [],
    stage: [],
    trainer: { top: 0, right: 0, bottom: 0, left: 0 },
    trainerCuts: [SWSH_SUPPORTER_RULE],
  },
  // The whole card, whatever it is: a Mega Hyper Rare, whose rule box is
  // gold like the rest of it, Pocket's Crown and Two Star, and an Ultra Rare
  // of the frames before Sword & Shield, none with a mask to measure against.
  'full-card': {
    art: { top: 0, right: 0, bottom: 0, left: 0 },
    regular: [],
    stage: [],
    trainer: { top: 0, right: 0, bottom: 0, left: 0 },
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
 * art window of the card's layout, and `trainer` its trainer's window where
 * the layout measured one; the border and the whole card are the same on
 * every card.
 */
export function regionFor(shape: ClipShape, layout: CardLayout = 'other'): RegionRect {
  if (isArtWindow(shape)) return LAYOUTS[layout].art;
  if (shape === 'trainer') return LAYOUTS[layout].trainer ?? REGIONS.trainer;
  return REGIONS[shape];
}

/**
 * The boxes cut out of that rect: what the layout's frame prints over the
 * art, or over a trainer's window where the layout measured it.
 */
export function cutsFor(shape: ClipShape, layout: CardLayout = 'other'): readonly CutBox[] {
  if (isArtWindow(shape)) return LAYOUTS[layout][shape];
  if (shape === 'trainer') return LAYOUTS[layout].trainerCuts ?? [];
  return [];
}

const insideRect = (r: RegionRect, x: number, y: number): boolean =>
  x >= r.left && x <= 1 - r.right && y >= r.top && y <= 1 - r.bottom;

/**
 * Whether the foil covers this point. `x` and `y` are fractions of the card
 * from its top-left; `border` adds the card's border, all of it outside the
 * `borders` rect, for an effect whose foil covers that too
 * (HoloSelection.border). The GLSL coverage() in shader/base.ts computes the
 * same thing from the same numbers, which the scene hands it as uniforms —
 * this is its testable twin.
 */
export function coversPoint(
  shape: ClipShape,
  x: number,
  y: number,
  invert: boolean,
  layout: CardLayout = 'other',
  border = false,
): boolean {
  let inside = insideRect(regionFor(shape, layout), x, y);
  if (inside && cutsFor(shape, layout).some((c) => x >= c.x0 && x < c.x1 && y >= c.y0 && y < c.y1))
    inside = false;
  if (border && !insideRect(REGIONS.borders, x, y)) inside = true;
  return invert ? !inside : inside;
}
