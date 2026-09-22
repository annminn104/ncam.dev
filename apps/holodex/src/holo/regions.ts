import type { ClipShape } from './select';

/** Insets as fractions of the card, matching the reference's CSS percentages. */
export interface RegionRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Passed to the shader as an int so it can branch on the outline's shape. */
export const SHAPE_ID: Record<ClipShape, number> = {
  full: 0,
  regular: 1,
  stage: 2,
  trainer: 3,
  borders: 4,
};

/**
 * Straight from pokemon-cards-css:
 *   --clip:         inset(9.85% 8% 52.85% 8%)
 *   --clip-trainer: inset(14.5% 8.5% 48.2% 8.5%)
 *   --clip-borders: inset(2.8% 4% round 2.55% / 1.5%)
 * `stage` shares regular's outer bounds and cuts a step out of the top-left,
 * where an evolution card's "evolves from" box overlaps the art.
 */
const REGIONS: Record<ClipShape, RegionRect> = {
  full: { top: 0, right: 0, bottom: 0, left: 0 },
  regular: { top: 0.0985, right: 0.08, bottom: 0.5285, left: 0.08 },
  stage: { top: 0.0985, right: 0.08, bottom: 0.5285, left: 0.08 },
  trainer: { top: 0.145, right: 0.085, bottom: 0.482, left: 0.085 },
  borders: { top: 0.028, right: 0.04, bottom: 0.028, left: 0.04 },
};

/**
 * The stage cut-out: everything left of `x` and above `y` is excluded.
 *
 * Exported because `shader/base.ts` interpolates these same two numbers into
 * the GLSL `coverage()` function. They used to be written out twice — once
 * here, once as a pair of literals in the shader — and changing either alone
 * left the suite green while the CPU-side `coversPoint` and the GPU-side
 * `coverage` silently disagreed. One owner now, read by both.
 */
export const STAGE_STEP = { x: 0.57, y: 0.16 };

export function regionFor(shape: ClipShape): RegionRect {
  return REGIONS[shape];
}

/**
 * Whether the foil covers this point. `x` and `y` are fractions of the card
 * from its top-left. The GLSL coverage function generated in Task 5 computes
 * the same thing from the same constants — this is its testable twin.
 */
export function coversPoint(shape: ClipShape, x: number, y: number, invert: boolean): boolean {
  const r = REGIONS[shape];
  let inside = x >= r.left && x <= 1 - r.right && y >= r.top && y <= 1 - r.bottom;
  if (inside && shape === 'stage' && x < STAGE_STEP.x && y < STAGE_STEP.y) inside = false;
  return invert ? !inside : inside;
}
