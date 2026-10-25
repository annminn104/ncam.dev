import { Quaternion, Vector3 } from 'three';
import {
  CUT_CAMERA_CLEAR,
  CUT_DISTANCES,
  cutHeight,
  type CutLevel,
  cutLevel,
  cutLevelFor,
  type CutMode,
  nearHouse,
} from '../scene/cutaway';
import type { CameraPose } from '../scene/schema';

/**
 * OrbitControls settings on the site route: distances in metres, the polar angle in radians from straight above. From
 * far enough away the camera may tip a little below the horizon, so the island's rock underside can be seen (`maxPolarAngle`
 * is that far-away limit; maxPolarFor lowers it nearer); panning stays off (the cursor moves the target instead).
 */
export const ORBIT_LIMITS = {
  minDistance: 14.5,
  maxDistance: 140,
  maxPolarAngle: Math.PI / 2 + 0.3,
  dampingFactor: 0.1,
} as const;

/**
 * The highest point of the house over its ground, metres: the tall house's rooftop grape trellis (12.76 m in house.glb,
 * over its 9.68 m roof). ORBIT_CLEARANCE.roofClear clears it; orbit.test.ts and the e2e (orbit.spec.ts) measure against it.
 */
export const HOUSE_TOP = 12.8;

/**
 * What the camera must stay out of, metres. The orbit turns around a point on the ground anywhere on the island (a zoom
 * or a turn takes it towards the point under the cursor, clampTarget keeps it on the island), so maxPolarFor measures
 * these from wherever it is. orbit.test.ts checks them against scene.json and the island generator.
 */
export const ORBIT_CLEARANCE = {
  /** The island's rim and rock reach this far from the yard's origin (siteplan/island.py: 29.96 m; the rock is narrower below). */
  islandRadius: 30,
  /** Margin outside the rim before the camera may dip below the ground plane; the lawn floor eases off over it. */
  margin: 3,
  /** What the camera keeps clear of round the house's footprint (house.glb stays within it, overhangs included). */
  houseMargin: 1.5,
  /** The lowest the camera goes while it could be over the house: the tall house's roof is 9.68 m, its trellis 12.76 m. */
  roofClear: 13.7,
  /** The lowest it goes while it could be over the island: over its trees (3.6 m), the pergola, the palms and the rockery. */
  lawnClear: 4,
  /** The lowest it goes beyond the rim before it may dip under the island: above the grass, never under it. */
  groundClear: 1.5,
  /**
   * While the house is cut away (cutaway.ts) its roof is gone, so over the house the camera may come down to this much
   * over the height that keeps the cut on (the cut plus CUT_CAMERA_CLEAR): never into what is left of the walls.
   */
  cutClear: 1.5,
} as const;

/**
 * The island's grass top (siteplan/zones.py ISLAND, siteplan/island.py): the superellipse |x / (w/2)|^n + |z / (d/2)|^n
 * = 1 on the yard's footprint, whose rim vertices are pulled in by up to `jitter` of the radius.
 */
export const ISLAND_RIM = { size: [54, 46], exponent: 4, jitter: 0.015 } as const;
/** The orbit target stays this far inside the rim, so the view always turns around the island and never empty sky. */
export const TARGET_MARGIN = 3;

/** Beyond the house's reach the roof clearance eases off over `EASE_NEAR` metres; below the horizon opens up over `EASE_FAR`. */
const EASE_NEAR = 8;
const EASE_FAR = 10;
/**
 * zoomToward goes all the way to a point at most this share of the camera's height over the target (or under it): the
 * zoom then brings the camera at least a quarter of the dolly's step closer to the target, never further away.
 */
export const ZOOM_RISE = 0.75;

const EPS = 1e-6;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Distance from the island's centre to its rim (less the jitter) in the direction `angle`, radians from +X towards +Z. */
export function rimRadius(angle: number): number {
  const [w, d] = ISLAND_RIM.size;
  const n = ISLAND_RIM.exponent;
  const c = Math.abs(Math.cos(angle)) / (w / 2);
  const s = Math.abs(Math.sin(angle)) / (d / 2);
  return (c ** n + s ** n) ** (-1 / n) * (1 - ISLAND_RIM.jitter);
}

function insideRim(target: readonly number[]): boolean {
  return (
    Math.hypot(target[0], target[2]) <=
    rimRadius(Math.atan2(target[2], target[0])) - TARGET_MARGIN + 1e-9
  );
}

/** `target`, pulled straight towards the island's centre until it is TARGET_MARGIN inside the rim. */
export function clampTarget(target: readonly number[]): [number, number, number] {
  const r = Math.hypot(target[0], target[2]);
  const limit = rimRadius(Math.atan2(target[2], target[0])) - TARGET_MARGIN;
  const scale = r > limit ? limit / r : 1;
  return [target[0] * scale, target[1], target[2] * scale];
}

/** The house as the clearances see it. */
export interface HouseBounds {
  /** Corners (x, z) of the box round its footprint on the ground, grown by ORBIT_CLEARANCE.houseMargin. */
  min: [number, number];
  max: [number, number];
  /** Its house focus: the middle of its footprint on its ground (the slot), which the dollhouse cut measures from. */
  focus: [number, number, number];
}

/** The house of `slot` (world space, glTF Y up) with this module footprint (w, d). */
export function houseBounds(
  slot: { position: readonly number[]; rotation: readonly number[] },
  footprint: readonly number[],
): HouseBounds {
  const [w, d] = footprint;
  const [x, y, z] = slot.position;
  const turn = new Quaternion(
    slot.rotation[0],
    slot.rotation[1],
    slot.rotation[2],
    slot.rotation[3],
  );
  const min: [number, number] = [Infinity, Infinity];
  const max: [number, number] = [-Infinity, -Infinity];
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const corner = new Vector3((sx * w) / 2, 0, (sz * d) / 2).applyQuaternion(turn);
    min[0] = Math.min(min[0], x + corner.x);
    min[1] = Math.min(min[1], z + corner.z);
    max[0] = Math.max(max[0], x + corner.x);
    max[1] = Math.max(max[1], z + corner.z);
  }
  const m = ORBIT_CLEARANCE.houseMargin;
  return { min: [min[0] - m, min[1] - m], max: [max[0] + m, max[1] + m], focus: [x, y, z] };
}

/** The horizontal distances from `target` the house box spans: its nearest side (0 from inside) and its farthest corner. */
export function houseSpan(
  target: readonly number[],
  house: HouseBounds,
): { near: number; far: number } {
  const [x, , z] = target;
  const dx = Math.max(house.min[0] - x, 0, x - house.max[0]);
  const dz = Math.max(house.min[1] - z, 0, z - house.max[1]);
  const fx = Math.max(Math.abs(x - house.min[0]), Math.abs(x - house.max[0]));
  const fz = Math.max(Math.abs(z - house.min[1]), Math.abs(z - house.max[1]));
  return { near: Math.hypot(dx, dz), far: Math.hypot(fx, fz) };
}

/** The lowest the camera may go over the house while `level` shows: a margin over the height that keeps the cut on. */
function cutFloor(level: Exclude<CutLevel, 'none'>): number {
  return cutHeight(level)! + CUT_CAMERA_CLEAR + ORBIT_CLEARANCE.cutClear;
}

/** How far through the hysteresis band of a cut `threshold` the house distance `reach` may be (0 below, 1 past it). */
function band(reach: number, threshold: number): number {
  const { hysteresis } = CUT_DISTANCES;
  return clamp01((reach - (threshold - hysteresis)) / (2 * hysteresis));
}

/**
 * The lowest the camera may be over the house while `level` shows, `reach` being as far as the camera can be from the
 * house focus (cutFor measures the cut from it): the cut's floor, rising to the next level's across the hysteresis band
 * a zoom out leaves the level at (the ground floor's to the upper floor's, that to the roof line), so whichever level
 * the camera switches to there the floor is the same on both sides of the switch.
 */
function houseFloor(level: CutLevel, reach: number): number {
  const { roofClear } = ORBIT_CLEARANCE;
  if (level === 'none') return roofClear;
  // the basement's cut lies under the lawn and only a button holds it, whatever the distance: its floor is the ground
  // floor cut's own (5.55 m), so "Tầng 1" takes over from a low "Hầm" view where the camera is (it looks down into the
  // pit from there)
  if (level === 'basement') return cutFloor('ground');
  const upper =
    cutFloor('upper') + (roofClear - cutFloor('upper')) * band(reach, CUT_DISTANCES.upper);
  if (level === 'upper') return upper;
  return cutFloor('ground') + (upper - cutFloor('ground')) * band(reach, CUT_DISTANCES.ground);
}

/**
 * How low the camera may go at `distance` from `target` with the azimuth free, metres above the ground:
 * - over the island (it could be while it is within islandRadius + |target| of the target) above the trees (lawnClear),
 *   easing down to groundClear over `margin` once every position under the trees is beyond the rim;
 * - over the house (it could be while its horizontal distance d·sin φ can fall within houseSpan) above the roof line:
 *   short of the house's near side it may be lower, as long as it cannot reach it. That needs a height over
 *   √(d² − near²), which rises up to d / height metres per metre of zoom or of target move (some 5 m/m over the trees);
 *   the floor is that curve's tangent where it meets the roof line, at d = hypot(near, roofClear), which lies above it
 *   (the curve is concave) and rises hypot(near, roofClear) / roofClear (at most about 2 m/m from the island's far end).
 *   Once every position under the roof line is beyond the far corner the clearance eases off over EASE_NEAR metres;
 * - while the house is cut away the roof line gives way to the cut's floor (houseFloor), which only ever relaxes it.
 *   It eases by distance + |target − house focus|, as far as the camera can be from the house focus whatever the
 *   azimuth, so the camera comes down to a cut's own floor only with the target by the house: from CAM_idle's ground
 *   point, 20 m out, the ground floor cut's floor is still the upper floor's 10.36 m.
 */
function floorFor(
  distance: number,
  level: CutLevel,
  target: readonly number[],
  house: HouseBounds | null,
): number {
  const { islandRadius, margin, roofClear, lawnClear, groundClear } = ORBIT_CLEARANCE;
  const reach = islandRadius + Math.hypot(target[0], target[2]);
  const lawn =
    lawnClear +
    (groundClear - lawnClear) * clamp01((distance - Math.hypot(reach, lawnClear)) / margin);
  if (!house) return lawn;
  const { near, far } = houseSpan(target, house);
  const touch = Math.hypot(near, roofClear); // where √(d² − near²) reaches the roof line
  const beyond = Math.hypot(far, roofClear);
  const whole =
    distance <= beyond
      ? Math.min(roofClear, roofClear - ((touch - distance) * touch) / roofClear)
      : roofClear + (groundClear - roofClear) * clamp01((distance - beyond) / EASE_NEAR);
  if (level === 'none') return Math.max(lawn, whole);
  const offset = Math.hypot(target[0] - house.focus[0], target[2] - house.focus[2]);
  return Math.max(lawn, Math.min(whole, houseFloor(level, distance + offset)));
}

/**
 * The largest polar angle (radians from straight above) the camera may have at `distance` from the orbit `target`, so
 * that whatever the azimuth it never ends up inside the island, among its trees or inside the house: all island
 * materials are double-sided, so there the user would see the rock or the soil from the inside. The camera stays above
 * floorFor, and dips below the horizon only once it is outside the island even from this target (islandRadius +
 * |target| + margin), easing up to ORBIT_LIMITS.maxPolarAngle over 10 m, to see the underside. The limit changes
 * continuously with the distance and the target, so neither a zoom nor a turn that moves the target makes the camera
 * jump. While the house is cut away (`level`, interaction spec §2) the camera may come down to ORBIT_CLEARANCE.cutClear
 * over the height that keeps the cut on, which only ever relaxes the limit.
 */
export function maxPolarFor(
  distance: number,
  level: CutLevel,
  target: readonly number[],
  house: HouseBounds | null,
): number {
  const aboveFloor = Math.acos(Math.min(1, floorFor(distance, level, target, house) / distance));
  const dip =
    ORBIT_CLEARANCE.islandRadius + Math.hypot(target[0], target[2]) + ORBIT_CLEARANCE.margin;
  return (
    aboveFloor + (ORBIT_LIMITS.maxPolarAngle - aboveFloor) * clamp01((distance - dip) / EASE_FAR)
  );
}

/**
 * The dollhouse cut for a camera at `position` (interaction spec §2): on auto cutLevel by its distance to the house focus,
 * not to the orbit target, so zooming onto the vegetable garden leaves the house whole and zooming onto the house cuts
 * it; a level a floor button holds whatever the distance, as long as the camera clears its cut (cutLevelFor).
 */
export function cutFor(
  position: readonly number[],
  house: HouseBounds,
  previous: CutLevel,
  mode: CutMode = 'auto',
): CutLevel {
  const [x, y, z] = house.focus;
  return cutLevelFor(
    mode,
    Math.hypot(position[0] - x, position[1] - y, position[2] - z),
    position[1] - y,
    previous,
  );
}

/**
 * Whether a camera at `position` is near the house, close enough for the interior's small things to show (cutaway.ts
 * nearHouse), given whether it was so far: by its distance to the house focus, as cutFor measures, whatever the cut.
 */
export function nearFor(
  position: readonly number[],
  house: HouseBounds,
  wasNear: boolean,
): boolean {
  const [x, y, z] = house.focus;
  return nearHouse(Math.hypot(position[0] - x, position[1] - y, position[2] - z), wasNear);
}

const DEG = Math.PI / 180;

/**
 * Where a floor button takes the camera (interaction spec §2, floorPose): from farther than `far` metres from the house
 * focus, or looking down at it less steeply than `steep` (the site's first view: 110 m out, 13.8 degrees down, which
 * shows the basement as a pit and a storey as a wall), to `distance` from the house focus, `down` (radians) down onto
 * it: steeply into the basement's pit, less so onto a storey. The camera gets there over `time` seconds.
 */
export const FLOOR_VIEW = {
  far: 45,
  steep: 35 * DEG,
  distance: 35,
  down: { basement: 55 * DEG, ground: 40 * DEG, upper: 40 * DEG },
  time: 0.8,
} as const;
/** A lift (floorPose) leaves the camera this far (radians) inside the polar limit of the level it shows next. */
const LIFT_MARGIN = 0.01;

/** An orbit: the point it turns round, the camera's distance from it, its polar angle and azimuth (three's Spherical). */
export interface OrbitPose {
  target: [number, number, number];
  distance: number;
  polar: number;
  azimuth: number;
}

/**
 * Where a floor button picking `mode` takes the camera at `camera`, orbiting `target`, the cut showing `level`; null to
 * leave it where it is:
 * - a level of the house ("Tầng 2", "Tầng 1", "Hầm") from afar or from low down (FLOOR_VIEW.far, FLOOR_VIEW.steep): to
 *   the house focus, FLOOR_VIEW.distance from it and FLOOR_VIEW.down onto it, the camera's azimuth round the focus kept;
 * - otherwise, a camera under the floor of what `mode` shows (maxPolarFor; on "Tự động" the level its distance calls for
 *   once the camera clears its cut) goes up round its target, at the same distance and azimuth, to just inside that
 *   level's limit: from a low "Hầm" view "Mái" lifts it over the roof line before the roof comes back.
 * cursorOrbit eases the camera there, and holds the level it shows until the camera clears the next one's floor.
 */
export function floorPose(
  mode: CutMode,
  camera: readonly number[],
  target: readonly number[],
  house: HouseBounds | null,
  level: CutLevel,
): OrbitPose | null {
  if (!house) return null;
  const [fx, fy, fz] = house.focus;
  const [dx, dy, dz] = [camera[0] - fx, camera[1] - fy, camera[2] - fz];
  const reach = Math.hypot(dx, dy, dz);
  if (
    mode !== 'none' &&
    mode !== 'auto' &&
    (reach > FLOOR_VIEW.far || Math.asin(dy / reach) < FLOOR_VIEW.steep)
  ) {
    return {
      target: [fx, fy, fz],
      distance: FLOOR_VIEW.distance,
      polar: Math.PI / 2 - FLOOR_VIEW.down[mode],
      azimuth: Math.atan2(dx, dz),
    };
  }
  const offset = [camera[0] - target[0], camera[1] - target[1], camera[2] - target[2]];
  const distance = Math.hypot(offset[0], offset[1], offset[2]);
  const polar = Math.acos(Math.min(1, Math.max(-1, offset[1] / distance)));
  const next = mode === 'auto' ? cutLevel(reach, Infinity, level) : mode;
  const limit = maxPolarFor(distance, next, target, house);
  if (polar <= limit + 1e-9) return null;
  return {
    target: [target[0], target[1], target[2]],
    distance,
    polar: limit - LIFT_MARGIN,
    azimuth: Math.atan2(offset[0], offset[2]),
  };
}

/** `angle` in (−π, π]. */
export function wrapAngle(angle: number): number {
  const wrapped = angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/**
 * What to add to camera and target after OrbitControls turned the camera `angle` about the vertical through `target`
 * (its azimuth), so the turn is about the vertical through `pivot` instead: (I − R_y(angle)) (pivot − target). The
 * pivot then keeps its place on screen and the target stays at its height; the polar tilt still turns about the target.
 */
export function pivotShift(
  pivot: readonly number[],
  target: readonly number[],
  angle: number,
): [number, number, number] {
  const dx = pivot[0] - target[0];
  const dz = pivot[2] - target[2];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [dx - (c * dx + s * dz), 0, dz - (-s * dx + c * dz)];
}

/**
 * Turns OrbitControls' dolly about the target into a zoom towards `point`, the point under the cursor: OrbitControls has
 * just moved the camera to `camera`, `scale` times as far from `target` as before, on the same line of sight. This moves
 * camera and target by the same share of the way to the point, (1 − scale) (point − target), which scales them both
 * about it, so it stays under the cursor; then slides the target along the line of sight back onto the ground, where the
 * orbit turns. Steps compose: one long step lands where many short ones do. A point nearly as high over the target as
 * the camera (or higher: a low view onto the roof) would slide the target far off along a line of sight that grazes the
 * ground, so the step goes only part of the way onto a point more than ZOOM_RISE of the camera's height up, and only as
 * far as keeps the target on the island (clampTarget): the rest is the plain dolly. A level line of sight never meets
 * the ground again: the dolly stays as it is.
 */
export function zoomToward(
  camera: readonly number[],
  target: readonly number[],
  point: readonly number[],
  scale: number,
): { camera: [number, number, number]; target: [number, number, number] } {
  const share = 1 - scale;
  const sight = [target[0] - camera[0], target[1] - camera[1], target[2] - camera[2]];
  const step = [
    share * (point[0] - target[0]),
    share * (point[1] - target[1]),
    share * (point[2] - target[2]),
  ];
  const copy = (v: readonly number[]): [number, number, number] => [v[0], v[1], v[2]];
  if (Math.abs(sight[1]) < EPS && Math.abs(step[1]) > EPS)
    return { camera: copy(camera), target: copy(target) };
  // the slide along the line of sight, as a share of it, that puts the moved target back at the target's height, and
  // the point's height over the target as a share of the camera's before the dolly
  const slide = Math.abs(sight[1]) < EPS ? 0 : -step[1] / sight[1];
  const rise = Math.abs(sight[1]) < EPS ? 0 : (-scale * (point[1] - target[1])) / sight[1];
  const moved = (part: number) =>
    copy([0, 1, 2].map((k) => target[k] + part * (step[k] + slide * sight[k])));
  let part = Math.min(1, ZOOM_RISE / Math.max(Math.abs(rise), 1e-12));
  if (insideRim(target) && !insideRim(moved(part))) {
    let lo = 0;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + part) / 2;
      if (insideRim(moved(mid))) lo = mid;
      else part = mid;
    }
    part = lo;
  }
  const next = moved(part);
  next[1] = target[1];
  return { camera: copy([0, 1, 2].map((k) => camera[k] + part * step[k])), target: next };
}

/**
 * The point the orbit turns around: where the pose's forward ray (-Z) meets the ground plane y = `groundY` (glTF, Y
 * up). The origin when the ray never gets there (it points up or level, or the camera is under the ground looking down).
 */
export function orbitTarget(
  pose: Pick<CameraPose, 'position' | 'rotation'>,
  groundY = 0,
): [number, number, number] {
  const origin = new Vector3(...pose.position);
  const forward = new Vector3(0, 0, -1).applyQuaternion(new Quaternion(...pose.rotation));
  if (forward.y > -EPS) return [0, 0, 0];
  const distance = (groundY - origin.y) / forward.y;
  if (distance <= 0) return [0, 0, 0];
  const hit = origin.addScaledVector(forward, distance);
  return [hit.x, groundY, hit.z];
}
