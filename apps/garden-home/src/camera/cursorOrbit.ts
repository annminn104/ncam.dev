import { Spherical, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CutLevel, CutMode } from '../scene/cutaway';
import {
  clampTarget,
  cutFor,
  FLOOR_VIEW,
  floorPose,
  type HouseBounds,
  maxPolarFor,
  ORBIT_LIMITS,
  type OrbitPose,
  pivotShift,
  wrapAngle,
  zoomToward,
} from './orbit';

const EPS = 1e-9;
/**
 * A frame moves a floor button's ease on by at most this long (s): the first frame after an idle wait on the demand
 * frameloop comes with the whole wait as its delta, which would end the ease in one jump.
 */
const MAX_EASE_STEP = 0.05;
/** Smoothstep: the share of an ease done `t` of the way through its time. */
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * The first point of the scene the user sees under client (x, y) of the canvas, null over the sky: along the ray from
 * the camera, or from `origin` in the same direction (where the camera stood before a zoom moved it).
 */
export type ScenePick = (x: number, y: number, origin?: Vector3) => Vector3 | null;

/** What the site camera adds to OrbitControls so zoom and rotation follow the cursor (interaction spec §6). */
export interface CursorOrbit {
  /**
   * A press at client (x, y): ends the pivot and a floor button's ease; a press that turns the camera (`rotates`) pivots
   * round the point under it.
   */
  press(x: number, y: number, rotates: boolean): void;
  /** After OrbitControls handled an event that may have zoomed (a wheel step, a pinch, a dolly drag) centred on (x, y). */
  zoomed(x: number, y: number): void;
  /**
   * Once a frame, before drawing, `delta` seconds after the last: damping, a floor button's ease, the target kept on the
   * island, the polar limit and the cut.
   */
  frame(delta?: number): void;
  /**
   * A floor button, the one already on too: the cut follows `mode` from the next frame on, and the camera eases where
   * floorPose says (to the house from afar, or up to the floor of what it shows next) over FLOOR_VIEW.time; meanwhile
   * the level shown waits for the camera to clear the next one's floor, even once a press, a zoom or a drag has ended the
   * ease, so leaving a low "Basement" view never shows the whole house in between nor jumps up the polar limit.
   */
  choose(mode: CutMode): void;
  /** Whether a floor button's ease is under way (OrbitRig keeps drawing until it ends). */
  readonly easing: boolean;
  /** The point the drag turns round, null while it turns round the target. */
  readonly pivot: Vector3 | null;
  /** The camera's polar angle round the target as it is drawn (OrbitControls' getPolarAngle is its last update's). */
  readonly polar: number;
  /** The dollhouse cut for the camera (cutFor). */
  readonly level: CutLevel;
  /** What the floor buttons picked: the cut follows it from the next frame on (cutFor's mode); `choose` also moves the camera. */
  mode: CutMode;
  dispose(): void;
}

/**
 * Sets up OrbitControls for the site route (damping, no pan, the zoom range) and makes it follow the cursor:
 * - a zoom goes towards the point under the cursor (zoomToward), which stays under it; over the sky it goes towards
 *   the target. OrbitControls zooms about its target, and `zoomed` then moves camera and target. Three's own
 *   zoomToCursor is left off: within 20 degrees of the horizon (CAM_idle looks 15.5 degrees down) it only turns the
 *   camera back to the old target, so the point under the cursor slides away.
 * - a drag turns round the vertical through the point under the press: every turn OrbitControls makes (in its pointer
 *   handlers and in the damping steps of `frame`) is shifted by pivotShift as it happens ('change'), until the next
 *   press or a zoom. The tilt still turns round the target; a press on the sky turns round the target.
 * - the target stays TARGET_MARGIN inside the island's rim (clampTarget), the camera moved with it, and the polar limit
 *   follows the distance and the target (maxPolarFor), so the camera never ends up in the house or the rock.
 * - a floor button (`choose`) eases the orbit where floorPose says over FLOOR_VIEW.time, a share of the way left each
 *   frame (smoothstep in time), under the clamp and the limit; a press, a zoom or a drag OrbitControls starts ends it
 *   where it is, the level shown still waiting for the camera to clear the floor of the one picked (`holding`).
 */
export function createCursorOrbit(
  orbit: OrbitControls,
  pick: ScenePick,
  house: HouseBounds | null,
): CursorOrbit {
  const camera = orbit.object;
  orbit.enableDamping = true;
  orbit.enablePan = false;
  orbit.zoomToCursor = false;
  orbit.dampingFactor = ORBIT_LIMITS.dampingFactor;
  orbit.minDistance = ORBIT_LIMITS.minDistance;
  orbit.maxDistance = ORBIT_LIMITS.maxDistance;

  let pivot: Vector3 | null = null;
  let level: CutLevel = 'none';
  let mode: CutMode = 'auto';
  /** A floor button's ease: where it goes and how far into FLOOR_VIEW.time it is. */
  let ease: { goal: OrbitPose; elapsed: number } | null = null;
  /**
   * Whether the level shown waits for the camera: set by `choose` when the floor button's pose lifts the camera or the
   * level it picks would show the whole house from where the camera is. It outlives the ease (a press, a zoom or a drag
   * ends that midway, the camera still under the next level's floor) and ends once the camera clears that floor (the
   * level shown moves on) or with the mode.
   */
  let holding = false;
  const goal = new Vector3();
  /** The azimuth and the distance the rig last saw: a change since is OrbitControls' turn or zoom. */
  let azimuth = azimuthOf();
  let distance = orbit.getDistance();
  const shift = new Vector3();
  const offset = new Vector3();
  const spherical = new Spherical();

  function azimuthOf(): number {
    return Math.atan2(camera.position.x - orbit.target.x, camera.position.z - orbit.target.z);
  }

  function move(x: number, y: number, z: number): void {
    shift.set(x, y, z);
    camera.position.add(shift);
    orbit.target.add(shift);
  }

  /** Makes the turn OrbitControls made since the last look one round the pivot. A shift keeps the azimuth. */
  function turned(): void {
    const now = azimuthOf();
    const angle = wrapAngle(now - azimuth);
    if (pivot && angle !== 0) move(...pivotShift(pivot.toArray(), orbit.target.toArray(), angle));
    azimuth = now;
  }

  /** Keeps the distance where OrbitControls would clamp it on its next update, along the line of sight. */
  function clampDistance(): void {
    const now = orbit.getDistance();
    const clamped = Math.min(ORBIT_LIMITS.maxDistance, Math.max(ORBIT_LIMITS.minDistance, now));
    if (clamped !== now)
      camera.position
        .sub(orbit.target)
        .multiplyScalar(clamped / now)
        .add(orbit.target);
  }

  /** The camera's polar angle round the target now, left in `spherical` (OrbitControls' is its last update's). */
  function polarOf(): number {
    return spherical.setFromVector3(offset.copy(camera.position).sub(orbit.target)).phi;
  }

  /**
   * The polar limit for where camera and target are now, applied at once (zooming in from low down lowers it, and so
   * can a turn round the pivot that carried the target towards the house): the camera tips up round the target onto
   * it. Not by orbit.update(): that would take another damping step, whose turn round the pivot would move the target
   * again after the clamp and this limit.
   */
  function limit(): void {
    const polar = maxPolarFor(orbit.getDistance(), level, orbit.target.toArray(), house);
    orbit.maxPolarAngle = polar;
    if (polarOf() > polar + EPS) {
      spherical.phi = polar;
      camera.position.copy(orbit.target).add(offset.setFromSpherical(spherical));
      camera.lookAt(orbit.target);
    }
  }

  /**
   * Moves the ease on by `delta` seconds: camera and target the share of the way left to its goal that the smoothstep
   * covers in that time, round the target (distance, polar angle, azimuth), so it ends at its goal at FLOOR_VIEW.time
   * whatever damping or the clamp did in between.
   */
  function step(delta: number): void {
    const { goal: to } = ease!;
    const done = smooth(ease!.elapsed / FLOOR_VIEW.time);
    ease!.elapsed = Math.min(
      FLOOR_VIEW.time,
      ease!.elapsed + Math.min(Math.max(delta, 0), MAX_EASE_STEP),
    );
    const share = done >= 1 ? 1 : (smooth(ease!.elapsed / FLOOR_VIEW.time) - done) / (1 - done);
    const now = { distance: orbit.getDistance(), polar: polarOf(), azimuth: azimuthOf() };
    orbit.target.lerp(goal.set(...to.target), share);
    spherical.set(
      now.distance + (to.distance - now.distance) * share,
      now.polar + (to.polar - now.polar) * share,
      now.azimuth + wrapAngle(to.azimuth - now.azimuth) * share,
    );
    camera.position.copy(orbit.target).add(offset.setFromSpherical(spherical));
    camera.lookAt(orbit.target);
    azimuth = azimuthOf(); // the rig's own move, not a turn of OrbitControls round a pivot
    if (ease!.elapsed >= FLOOR_VIEW.time) ease = null;
  }

  /** Whether the polar limit of `next` would tip the camera up from where it is now. */
  function lifts(next: CutLevel): boolean {
    return polarOf() > maxPolarFor(orbit.getDistance(), next, orbit.target.toArray(), house) + EPS;
  }

  const stop = () => {
    ease = null;
  };
  orbit.addEventListener('change', turned);
  orbit.addEventListener('start', stop); // the user's drag or wheel: never fight it
  orbit.maxPolarAngle = maxPolarFor(distance, level, orbit.target.toArray(), house);
  orbit.update(); // looks at the target: the pose's own direction, so the first frame does not jump
  azimuth = azimuthOf();

  return {
    press(x, y, rotates) {
      turned(); // the turn so far belongs to the pivot it began with
      pivot = rotates ? pick(x, y) : null;
      ease = null;
    },
    zoomed(x, y) {
      ease = null;
      const now = orbit.getDistance();
      if (Math.abs(now - distance) < EPS) return; // OrbitControls took no zoom from it (mid-drag, or at a limit)
      turned();
      pivot = null;
      const scale = now / distance;
      // the camera where it stood before the zoom, looking the same way: what the user saw under the cursor
      const before = camera.position
        .clone()
        .sub(orbit.target)
        .divideScalar(scale)
        .add(orbit.target);
      const point = pick(x, y, before);
      if (point) {
        const zoom = zoomToward(
          camera.position.toArray(),
          orbit.target.toArray(),
          point.toArray(),
          scale,
        );
        camera.position.set(...zoom.camera);
        orbit.target.set(...zoom.target);
        clampDistance();
      }
      distance = orbit.getDistance();
    },
    frame(delta = 1 / 60) {
      orbit.maxPolarAngle = maxPolarFor(orbit.getDistance(), level, orbit.target.toArray(), house);
      orbit.update(); // damping eases the camera out over the following frames
      turned();
      if (ease) step(delta);
      const target = orbit.target.toArray();
      const [x, , z] = clampTarget(target);
      if (x !== target[0] || z !== target[2]) move(x - target[0], 0, z - target[2]);
      limit();
      if (house) {
        const next = cutFor(camera.position.toArray(), house, level, mode);
        // after a floor button that lifts the camera, the level shown waits until the camera clears the next one: its
        // floor (no jump up the limit) and, for a level held, its cut (no whole house in between)
        const wait =
          holding &&
          next !== level &&
          (lifts(next) || (next === 'none' && mode !== 'none' && mode !== 'auto'));
        if (!wait) {
          level = next;
          holding = false;
        }
      }
      distance = orbit.getDistance();
    },
    choose(next) {
      mode = next;
      pivot = null;
      const position = camera.position.toArray();
      const to = floorPose(next, position, orbit.target.toArray(), house, level);
      ease = to && { goal: to, elapsed: 0 };
      const shown = house ? cutFor(position, house, level, next) : level;
      holding =
        shown !== level &&
        ((to !== null && to.polar < polarOf() - EPS) || lifts(shown) || shown === 'none');
    },
    get easing() {
      return ease !== null;
    },
    get pivot() {
      return pivot;
    },
    get polar() {
      return polarOf();
    },
    get level() {
      return level;
    },
    get mode() {
      return mode;
    },
    set mode(next: CutMode) {
      mode = next;
      holding = false;
    },
    dispose() {
      orbit.removeEventListener('change', turned);
      orbit.removeEventListener('start', stop);
    },
  };
}
