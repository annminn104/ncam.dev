import type { Side } from '../../game/coords';

// The camera rig's arithmetic, kept free of three so it runs under Node tests.

export const DISTANCE = 11;
/** Radians from straight up. */
export const POLAR = 0.95;

/**
 * How far the player can take the camera: zoom (the far limit scaled by `framingFit`) and
 * height (polar angle, radians from straight up). The arenas' scenery is checked against these.
 */
export const ORBIT = { minDistance: 6, maxDistance: 18, minPolar: 0.2, maxPolar: 1.35 } as const;

const TAU = Math.PI * 2;
/** Width / height at and above which the whole board fits the screen at DISTANCE. */
export const FIT_ASPECT = 1.5;
/**
 * The narrowest screen the camera still pulls back for (a phone in a tall in-app browser).
 * Narrower ones get this one's camera and lose a sliver of the board's sides: pulled back any
 * further, the camera would pass the arenas' scenery and the horizon walls, and see where the
 * world ends (layout.test.ts checks every camera up to this one).
 */
export const MIN_ASPECT = 0.38;

/**
 * How far to pull the camera back, as a multiple of DISTANCE, so the board's width fits a
 * screen of this aspect ratio. The vertical field of view is fixed, so a narrow screen sees a
 * narrow slice of the board: 1 on a landscape screen, 3 on a phone held upright, and never more
 * than at MIN_ASPECT.
 */
export function framingFit(aspect: number): number {
  return aspect > 0 ? Math.max(1, FIT_ASPECT / Math.max(aspect, MIN_ASPECT)) : 1;
}

/** Orbit azimuth that puts the camera at `side`'s end of the board (white sits at +z). */
export function azimuthOf(side: Side): number {
  return side === 'w' ? 0 : Math.PI;
}

/** Where the camera stands at rest, looking at the centre of the board from `side`'s end. */
export function homePosition(side: Side, fit = 1): [x: number, y: number, z: number] {
  const azimuth = azimuthOf(side);
  const distance = DISTANCE * fit;
  return [
    distance * Math.sin(POLAR) * Math.sin(azimuth),
    distance * Math.cos(POLAR),
    distance * Math.sin(POLAR) * Math.cos(azimuth),
  ];
}

/**
 * `azimuth`, or the full-turn equivalent of it nearest to `current`. The camera's azimuth only
 * ever accumulates, so aiming it at a bare 0 or π would unwind every turn the player has spun.
 */
export function nearestAzimuth(current: number, azimuth: number): number {
  return azimuth + TAU * Math.round((current - azimuth) / TAU);
}

/** cos(azimuth) inside ±VIEW_BAND is "side-on" (within ~11.5° of it). */
const VIEW_BAND = 0.2;

/**
 * Which end of the board a camera at `azimuth` looks from, so the keyboard board's arrow keys
 * follow the screen. Side-on, `previous` stands: a camera parked there doesn't flip-flop.
 */
export function viewSideOf(azimuth: number, previous: Side): Side {
  const towardsWhite = Math.cos(azimuth);
  if (towardsWhite > VIEW_BAND) return 'w';
  if (towardsWhite < -VIEW_BAND) return 'b';
  return previous;
}
