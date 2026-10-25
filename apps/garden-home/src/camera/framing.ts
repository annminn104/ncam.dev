import type { Align } from '../params';

/** Share of the width where the scene's screen centre (the camera's optical axis) lands for each ?align= on a wide screen. */
export const ALIGN_CENTRE: Record<Align, number> = { left: 0.32, center: 0.5, right: 0.68 };

/**
 * How far the island's rim reaches either side of the optical axis from CAM_idle, in viewport heights (the vertical field
 * of view is fixed, so on screen that is this over the aspect ratio of the width: 0.28 at 16:10, 0.34 at 4:3, more than
 * the whole width on a phone held upright). framing.test.ts measures it from scene.json.
 */
export const ISLAND_HALF_HEIGHTS = 0.455;
/** Share of the width kept free between the island's rim and the screen edge. */
export const EDGE_MARGIN = 0.02;

/**
 * Where the optical axis lands for `align` on a screen of this aspect ratio (width / height): ALIGN_CENTRE on 16:10 and
 * wider, then pulled towards the middle as the screen narrows, just far enough that the island's rim stays on screen
 * (4:3: 64 %), and in the middle once the island is wider than the screen (portrait).
 */
export function alignCentre(align: Align, aspect: number): number {
  const shift = ALIGN_CENTRE[align] - 0.5;
  const room = 0.5 - ISLAND_HALF_HEIGHTS / aspect - EDGE_MARGIN;
  return 0.5 + Math.sign(shift) * Math.min(Math.abs(shift), Math.max(0, room));
}

/** Arguments of PerspectiveCamera.setViewOffset, in CSS pixels. */
export interface ViewOffset {
  fullWidth: number;
  fullHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The view offset that slides the picture sideways so the optical axis lands at alignCentre(align, aspect) of the width:
 * a window the size of the canvas cut from a virtual image of the same size, shifted by x. The field of view and the
 * aspect stay as they are, so the perspective does not change; null for `center` (clearViewOffset).
 */
export function viewOffsetFor(align: Align, width: number, height: number): ViewOffset | null {
  if (align === 'center') return null;
  return {
    fullWidth: width,
    fullHeight: height,
    x: (0.5 - alignCentre(align, width / height)) * width,
    y: 0,
    width,
    height,
  };
}
