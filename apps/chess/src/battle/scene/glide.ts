// A piece's glide from square to square, and the stretch of it its qi trail covers. React- and
// three-free, so Node tests can follow a glide frame by frame.

/** How long a piece takes to glide to its new square. */
export const MOVE_MS = 350;
/** How high the glide's arc rises above the squares. */
export const ARC_HEIGHT = 0.8;
/** How far behind the piece (in glide time) its qi trail ends: it lands this long after it. */
export const TRAIL_MS = 260;

export interface Glide {
  from: [x: number, z: number];
  /** Height at take-off: a selected piece is lifted, and the arc starts from there. */
  fromY: number;
  to: [x: number, z: number];
  /**
   * Milliseconds since take-off, summed from frame deltas. Never read off R3F's clock: it
   * restarts from 0 whenever the frame loop does (Battle pauses it while the tab is hidden), and a
   * glide timed against it would then fly off its arc.
   */
  elapsed: number;
}

export interface Point {
  x: number;
  y: number;
  z: number;
}

/** Where the piece is `t` of the way through the glide (0 take-off, 1 landing), into `out`. */
export function glideAt(g: Glide, t: number, out: Point): Point {
  const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  out.x = g.from[0] + (g.to[0] - g.from[0]) * e;
  out.z = g.from[1] + (g.to[1] - g.from[1]) * e;
  out.y = g.fromY * (1 - e) + Math.sin(Math.PI * t) * ARC_HEIGHT;
  return out;
}

/**
 * The stretch of the glide its qi trail covers `elapsed` ms after take-off, as glide progress
 * [tail, head] (the head is the piece), or null when there is nothing to draw: at take-off, and
 * once the tail has landed as well. Written into `out`, so a frame loop allocates nothing.
 */
export function trailSpan(
  elapsed: number,
  out: [tail: number, head: number] = [0, 0],
): [tail: number, head: number] | null {
  out[1] = Math.min(1, Math.max(0, elapsed / MOVE_MS));
  out[0] = Math.min(1, Math.max(0, (elapsed - TRAIL_MS) / MOVE_MS));
  return out[1] - out[0] > 1e-3 ? out : null;
}

/** A glide is kept after the piece lands, until its trail has landed too. */
export const glideDone = (g: Glide) => g.elapsed >= MOVE_MS + TRAIL_MS;
