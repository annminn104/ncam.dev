import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { describe, expect, it } from 'vitest';
import sceneJson from '../../public/assets/scene.json?raw';
import { CUT_CAMERA_CLEAR, cutHeight } from '../scene/cutaway';
import { sceneSchema } from '../scene/schema';
import { createCursorOrbit, type ScenePick } from './cursorOrbit';
import {
  clampTarget,
  FLOOR_VIEW,
  houseBounds,
  maxPolarFor,
  ORBIT_CLEARANCE,
  ORBIT_LIMITS,
  orbitTarget,
  rimRadius,
  TARGET_MARGIN,
} from './orbit';

const scene = sceneSchema.parse(JSON.parse(sceneJson));
const houseSlot = scene.slots.find((slot) => slot.module === 'house')!;
const HOUSE = houseBounds(houseSlot, scene.modules.house.footprint);

/** A 1280 x 800 canvas at the page's top left, as the e2e sees it. */
const WIDTH = 1280;
const HEIGHT = 800;

function setup(start: { position: [number, number, number]; target: [number, number, number] }) {
  const camera = new PerspectiveCamera(32, WIDTH / HEIGHT, 0.1, 500);
  camera.position.set(...start.position);
  const orbit = new OrbitControls(camera); // no canvas: the test calls what its event handlers would
  orbit.target.set(...start.target);
  orbit.update();
  return { camera, orbit };
}

/** The point a client (x, y) of the canvas shows on the ground plane, seen from the camera or from `origin`. */
function groundPick(camera: PerspectiveCamera): ScenePick {
  const raycaster = new Raycaster();
  const ground = new Plane(new Vector3(0, 1, 0), 0);
  return (x, y, origin) => {
    camera.updateMatrixWorld();
    raycaster.setFromCamera(new Vector2((x / WIDTH) * 2 - 1, -(y / HEIGHT) * 2 + 1), camera);
    if (origin) raycaster.ray.origin.copy(origin);
    return raycaster.ray.intersectPlane(ground, new Vector3());
  };
}

/** Where `point` shows on the canvas, client pixels. */
function screenOf(camera: PerspectiveCamera, point: Vector3): [number, number] {
  camera.updateMatrixWorld();
  const ndc = point.clone().project(camera);
  return [((ndc.x + 1) / 2) * WIDTH, ((1 - ndc.y) / 2) * HEIGHT];
}

const frames = (cursor: { frame(): void }, count: number) => {
  for (let i = 0; i < count; i++) cursor.frame();
};

/**
 * A camera at `position` low over the basement's pit under "Basement", orbiting `target`: it gets there from high up once the
 * basement's cut holds (whole, the house's roof line would lift it at once).
 */
function inThePit(position: [number, number, number], target: [number, number, number]) {
  const { camera, orbit } = setup({
    position: [target[0], target[1] + 30, target[2] + 20],
    target,
  });
  const cursor = createCursorOrbit(orbit, () => null, HOUSE);
  cursor.mode = 'basement';
  frames(cursor, 2);
  camera.position.set(...position);
  frames(cursor, 2);
  return { camera, orbit, cursor };
}

describe('createCursorOrbit', () => {
  it('sets OrbitControls up for the site: damping, no pan, the zoom range', () => {
    const { orbit } = setup({ position: [30, 30, 34], target: [4, 0, 4] });
    createCursorOrbit(orbit, () => null, HOUSE);
    expect(orbit.enableDamping).toBe(true);
    expect(orbit.dampingFactor).toBe(ORBIT_LIMITS.dampingFactor);
    expect(orbit.enablePan).toBe(false);
    expect(orbit.zoomToCursor).toBe(false); // the rig zooms to the cursor itself: three's gives up within 20 degrees of the horizon
    expect([orbit.minDistance, orbit.maxDistance]).toEqual([
      ORBIT_LIMITS.minDistance,
      ORBIT_LIMITS.maxDistance,
    ]);
  });

  it('zooms towards the point under the cursor: it stays under it, in and out', () => {
    const { camera, orbit } = setup({ position: [30, 30, 34], target: [4, 0, 4] });
    const pick = groundPick(camera);
    const cursor = createCursorOrbit(orbit, pick, HOUSE);
    frames(cursor, 2);
    const at: [number, number] = [380, 520]; // left of and below the middle
    const point = pick(...at)!;
    const start = orbit.target.clone();
    let travel = 0;
    for (const step of [
      () => orbit.dollyIn(0.9),
      () => orbit.dollyIn(0.8),
      () => orbit.dollyOut(0.7),
    ]) {
      const before = orbit.getDistance();
      step(); // OrbitControls has zoomed about its target...
      cursor.zoomed(...at); // ...and the rig turns it into a zoom about the point
      frames(cursor, 3);
      const [x, y] = screenOf(camera, point);
      expect(Math.hypot(x - at[0], y - at[1])).toBeLessThan(1e-6);
      expect(orbit.target.y).toBeCloseTo(0, 9);
      expect(orbit.getDistance() / before).not.toBeCloseTo(1, 3);
      travel = Math.max(travel, orbit.target.distanceTo(start));
    }
    // the target went towards the point with the camera, and back out
    expect(travel).toBeGreaterThan(2);
  });

  it('zooms about the target when nothing is under the cursor (the sky)', () => {
    const { orbit } = setup({ position: [30, 30, 34], target: [4, 0, 4] });
    const cursor = createCursorOrbit(orbit, () => null, HOUSE);
    const before = orbit.getDistance();
    orbit.dollyIn(0.9);
    cursor.zoomed(640, 20);
    frames(cursor, 2);
    expect(orbit.target.toArray()).toEqual([4, 0, 4]);
    expect(orbit.getDistance()).toBeCloseTo(before * 0.9, 9);
  });

  it('turns a drag that starts on the scene round the point under it, damping and all', () => {
    const { camera, orbit } = setup({ position: [30, 30, 34], target: [4, 0, 4] });
    const pick = groundPick(camera);
    const cursor = createCursorOrbit(orbit, pick, HOUSE);
    frames(cursor, 2);
    const at: [number, number] = [520, 470];
    const point = pick(...at)!;
    cursor.press(...at, true);
    expect(cursor.pivot?.distanceTo(point)).toBeLessThan(1e-9);
    const azimuth = orbit.getAzimuthalAngle();
    orbit.rotateLeft(0.5); // a drag step to the right: a tenth of the turn now, damping the rest frame by frame
    for (let i = 0; i < 200; i++) {
      cursor.frame();
      const [x, y] = screenOf(camera, point);
      expect(Math.hypot(x - at[0], y - at[1])).toBeLessThan(1e-6);
    }
    expect(orbit.getAzimuthalAngle() - azimuth).toBeCloseTo(-0.5, 6); // rotateLeft turns the azimuth back
    expect(orbit.target.y).toBeCloseTo(0, 9);
    expect(orbit.target.distanceTo(new Vector3(4, 0, 4))).toBeGreaterThan(1); // it turned round the point too
  });

  it('turns a drag that starts on the sky round the target, as before', () => {
    const { orbit } = setup({ position: [30, 30, 34], target: [4, 0, 4] });
    const cursor = createCursorOrbit(orbit, () => null, HOUSE);
    cursor.press(640, 20, true);
    expect(cursor.pivot).toBeNull();
    orbit.rotateLeft(0.5);
    frames(cursor, 100);
    expect(orbit.target.toArray()).toEqual([4, 0, 4]);
  });

  it('ends the pivot at a zoom and at the next press, and pivots only for a press that turns the camera', () => {
    const { camera, orbit } = setup({ position: [30, 30, 34], target: [4, 0, 4] });
    const cursor = createCursorOrbit(orbit, groundPick(camera), HOUSE);
    cursor.press(520, 470, true);
    expect(cursor.pivot).not.toBeNull();
    orbit.dollyIn(0.9);
    cursor.zoomed(520, 470);
    expect(cursor.pivot).toBeNull();
    cursor.press(520, 470, true);
    expect(cursor.pivot).not.toBeNull();
    cursor.press(700, 300, false); // a second finger, a right button
    expect(cursor.pivot).toBeNull();
    // a wheel OrbitControls ignored (mid-drag) zoomed nothing and leaves the pivot as it is
    cursor.press(520, 470, true);
    cursor.zoomed(520, 470);
    expect(cursor.pivot).not.toBeNull();
  });

  it('keeps the target on the island and moves the camera with it, so the view turns round the island', () => {
    const { camera, orbit } = setup({ position: [60, 30, 20], target: [40, 0, 0] });
    const cursor = createCursorOrbit(orbit, () => null, HOUSE);
    const offset = camera.position.clone().sub(orbit.target);
    cursor.frame();
    const [x, , z] = orbit.target.toArray();
    expect(Math.hypot(x, z)).toBeCloseTo(rimRadius(Math.atan2(z, x)) - TARGET_MARGIN, 9);
    expect(camera.position.clone().sub(orbit.target).distanceTo(offset)).toBeLessThan(1e-9);
  });

  it('lifts a camera that would be in the house to the limit for its distance and target', () => {
    const [fx, fy, fz] = HOUSE.focus;
    const { camera, orbit } = setup({ position: [fx, fy + 3, fz + 20], target: [fx, fy, fz] });
    const cursor = createCursorOrbit(orbit, () => null, HOUSE);
    cursor.frame();
    const limit = maxPolarFor(orbit.getDistance(), cursor.level, orbit.target.toArray(), HOUSE);
    expect(orbit.getPolarAngle()).toBeLessThanOrEqual(limit + 1e-9);
    expect(camera.position.y).toBeGreaterThan(8.5); // the roof line, easing off beyond the house's far corner
  });

  it('draws every frame of a fast turn round a far pivot within the limit and the clamp for where camera and target are', () => {
    // A damping step turns the camera round the pivot, which carries the target along (metres a step on a fast drag):
    // the clamp and the polar limit for the moved target must hold as the frame is drawn, with no damping step after them.
    const cases: {
      position: [number, number, number];
      target: [number, number, number];
      pivot: [number, number, number];
    }[] = [
      // low over the lawn in front of the house, the pivot swinging camera and target round onto the house (a damping
      // step after the limit drew a frame with the camera 1.5 m under the ground floor cut's floor, by the west wall)
      { position: [-0.64, 6, 14.6], target: [15, 0, 18], pivot: [4, 0, 0] },
      // under the horizon past the rim, the pivot taking the target out towards the rim (the dip starts further out)
      { position: [-60, -8, 30], target: [-10, 0, 6], pivot: [8, 0, 0] },
    ];
    const over = (level: string) =>
      level === 'none'
        ? ORBIT_CLEARANCE.roofClear
        : cutHeight(level as 'upper' | 'ground')! + CUT_CAMERA_CLEAR + ORBIT_CLEARANCE.cutClear;
    let checked = 0;
    for (const { position, target, pivot } of cases) {
      for (const turn of [4, -4, 2.5, -2.5]) {
        const { camera, orbit } = setup({ position, target });
        const cursor = createCursorOrbit(orbit, () => new Vector3(...pivot), HOUSE);
        orbit.rotateUp(-2); // tip the camera down onto its limit
        frames(cursor, 150);
        cursor.press(0, 0, true);
        orbit.rotateLeft(turn); // a drag of some 500 px in one move: a tenth of it a frame, the pivot shifting it all
        for (let i = 0; i < 80; i++) {
          cursor.frame();
          const at = orbit.target.toArray();
          const { x, y, z } = camera.position;
          const where = `(${position}) round (${pivot}) by ${turn}, frame ${i}: target (${at.map((v) => v.toFixed(2))}), camera (${[x, y, z].map((v) => v.toFixed(2))})`;
          const clamped = clampTarget(at);
          expect(
            Math.hypot(clamped[0] - at[0], clamped[2] - at[2]),
            `off the island: ${where}`,
          ).toBeLessThan(1e-9);
          const limit = maxPolarFor(orbit.getDistance(), cursor.level, at, HOUSE);
          const polar = Math.acos((y - at[1]) / orbit.getDistance()); // as drawn: OrbitControls' own is its last update's
          expect(polar, `past the limit: ${where}`).toBeLessThanOrEqual(limit + 1e-9);
          const inHouse =
            x > HOUSE.min[0] && x < HOUSE.max[0] && z > HOUSE.min[1] && z < HOUSE.max[1];
          if (inHouse)
            expect(y, `in the house: ${where}`).toBeGreaterThanOrEqual(over(cursor.level) - 1e-6);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(640);
  });

  it("cuts the house by the camera's distance to it, not to the target", () => {
    const veg = setup({ position: [-19, 16, 26], target: [-19, 0, 14] }); // 20 m from the vegetable garden
    const near = createCursorOrbit(veg.orbit, () => null, HOUSE);
    frames(near, 2);
    expect(veg.orbit.getDistance()).toBeCloseTo(20, 6);
    expect(near.level).toBe('none');
    const [fx, fy, fz] = HOUSE.focus;
    const house = setup({ position: [fx, fy + 16, fz + 12], target: [fx, fy, fz] }); // 20 m from the house
    const over = createCursorOrbit(house.orbit, () => null, HOUSE);
    frames(over, 2);
    expect(over.level).toBe('ground');
    const none = createCursorOrbit(house.orbit, () => null, null); // no house: nothing to cut
    none.frame();
    expect(none.level).toBe('none');
  });

  it("follows the floor buttons: the level picked from the next frame on, by the camera's distance again on auto", () => {
    const [fx, fy, fz] = HOUSE.focus;
    const far = setup({ position: [fx + 50, fy + 40, fz + 50], target: [fx, 0, fz] });
    const cursor = createCursorOrbit(far.orbit, () => null, HOUSE);
    cursor.frame();
    expect(cursor.mode).toBe('auto');
    expect(cursor.level).toBe('none');
    cursor.mode = 'basement';
    cursor.frame();
    expect(cursor.level).toBe('basement');
    cursor.mode = 'upper';
    cursor.frame();
    expect(cursor.level).toBe('upper');
    cursor.mode = 'auto';
    cursor.frame();
    expect(cursor.level).toBe('none');
  });

  it('eases a far camera to the house when a floor button is picked, smoothly over FLOOR_VIEW.time, the azimuth kept', () => {
    const [fx, fy, fz] = HOUSE.focus;
    const idle = scene.camera.idle;
    const start = setup({
      position: [...idle.position] as [number, number, number],
      target: orbitTarget(idle),
    });
    const cursor = createCursorOrbit(start.orbit, () => null, HOUSE);
    cursor.frame(1 / 60);
    const azimuth = Math.atan2(start.camera.position.x - fx, start.camera.position.z - fz);
    cursor.choose('basement');
    expect(cursor.mode).toBe('basement');
    expect(cursor.easing).toBe(true);
    const seen: { distance: number; position: Vector3; level: string }[] = [];
    for (let t = 0; t < FLOOR_VIEW.time + 0.2; t += 1 / 60) {
      cursor.frame(1 / 60);
      seen.push({
        distance: start.orbit.getDistance(),
        position: start.camera.position.clone(),
        level: cursor.level,
      });
    }
    expect(cursor.easing).toBe(false);
    expect(
      start.orbit.target
        .toArray()
        .map((v, k) => v - [fx, fy, fz][k])
        .every((v) => Math.abs(v) < 1e-6),
    ).toBe(true);
    expect(start.orbit.getDistance()).toBeCloseTo(FLOOR_VIEW.distance, 6);
    expect(cursor.polar).toBeCloseTo(Math.PI / 2 - (55 * Math.PI) / 180, 6); // 55 degrees down into the pit
    const offset = start.camera.position.clone().sub(start.orbit.target);
    expect(Math.atan2(offset.x, offset.z)).toBeCloseTo(azimuth, 6);
    expect(seen.every(({ level }) => level === 'basement')).toBe(true);
    // the whole way in steps a fraction of the way, ending where it ends: no frame jumps, it takes the time it says
    const settled = seen.findIndex(
      ({ distance }) => Math.abs(distance - FLOOR_VIEW.distance) < 1e-6,
    );
    expect(settled / 60).toBeGreaterThan(FLOOR_VIEW.time - 0.05);
    expect(settled / 60).toBeLessThan(FLOOR_VIEW.time + 0.05);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i].distance).toBeLessThanOrEqual(seen[i - 1].distance + 1e-9);
      // a smoothstep peaks at 1.5 times its mean speed: some 2.6 m a frame for the 80 m or so it covers at 60 frames a second
      expect(seen[i].position.distanceTo(seen[i - 1].position)).toBeLessThan(4);
    }
  });

  it('takes a large frame delta (the first frame after an idle wait) as one short step, so the ease never jumps', () => {
    const idle = scene.camera.idle;
    const { orbit } = setup({
      position: [...idle.position] as [number, number, number],
      target: orbitTarget(idle),
    });
    const cursor = createCursorOrbit(orbit, () => null, HOUSE);
    cursor.choose('ground');
    const before = orbit.getDistance();
    cursor.frame(5);
    expect(cursor.easing).toBe(true);
    expect(before - orbit.getDistance()).toBeLessThan(0.1 * (before - FLOOR_VIEW.distance));
  });

  it('leaves the camera where it is for "Roof" and "Auto", and for a level when it already looks down at the house', () => {
    const idle = scene.camera.idle;
    const far = setup({
      position: [...idle.position] as [number, number, number],
      target: orbitTarget(idle),
    });
    const cursor = createCursorOrbit(far.orbit, () => null, HOUSE);
    cursor.frame(1 / 60);
    const at = far.camera.position.clone();
    for (const mode of ['none', 'auto'] as const) {
      cursor.choose(mode);
      expect(cursor.easing, mode).toBe(false);
      frames(cursor, 30);
      expect(far.camera.position.distanceTo(at), mode).toBeLessThan(1e-6);
    }
    const [fx, fy, fz] = HOUSE.focus;
    const near = setup({ position: [fx, fy + 30, fz + 17], target: [fx, fy, fz] }); // 34 m out, 60 degrees down
    const steep = createCursorOrbit(near.orbit, () => null, HOUSE);
    steep.choose('basement');
    expect(steep.easing).toBe(false);
  });

  it("stops easing at a press, a zoom or a drag OrbitControls starts: the user's move wins", () => {
    const idle = scene.camera.idle;
    for (const interrupt of ['press', 'zoomed', 'start'] as const) {
      const { camera, orbit } = setup({
        position: [...idle.position] as [number, number, number],
        target: orbitTarget(idle),
      });
      const cursor = createCursorOrbit(orbit, () => null, HOUSE);
      cursor.choose('upper');
      for (let i = 0; i < 12; i++) cursor.frame(1 / 60);
      if (interrupt === 'press') cursor.press(640, 400, true);
      else if (interrupt === 'zoomed') cursor.zoomed(640, 400);
      else orbit.dispatchEvent({ type: 'start' });
      expect(cursor.easing, interrupt).toBe(false);
      const at = camera.position.clone();
      for (let i = 0; i < 30; i++) cursor.frame(1 / 60);
      expect(camera.position.distanceTo(at), interrupt).toBeLessThan(1e-6);
    }
  });

  it('never shows the whole house between "Basement", "Ground floor", "Upper floor" and "Auto" from a low view into the pit, nor jumps', () => {
    const [fx, fy, fz] = HOUSE.focus;
    // "Basement" zoomed in low: 18 m from the house focus, on the basement's camera floor, 18 degrees down
    const low = inThePit([fx, fy + 5.6, fz + Math.sqrt(18 * 18 - 5.6 * 5.6)], [fx, fy, fz]);
    const { cursor } = low;
    expect(cursor.level).toBe('basement');
    expect(low.camera.position.y).toBeCloseTo(fy + 5.6, 6);
    const levels: string[] = [];
    let at = low.camera.position.clone();
    let step = 0;
    for (const mode of ['ground', 'upper', 'auto'] as const) {
      cursor.choose(mode);
      for (let t = 0; t < FLOOR_VIEW.time + 0.2; t += 1 / 60) {
        cursor.frame(1 / 60);
        levels.push(cursor.level);
        step = Math.max(step, low.camera.position.distanceTo(at));
        at = low.camera.position.clone();
      }
      if (mode !== 'auto') expect(cursor.level, mode).toBe(mode);
    }
    expect(levels).not.toContain('none');
    expect(step).toBeLessThan(1.5);
  });

  it('lifts a camera under the floor of the level picked before it shows it: the level it shows meanwhile, then that one', () => {
    const [fx, fy, fz] = HOUSE.focus;
    // low over the pit's west half, looking down at it steeply, the orbit turning round a point by the karaoke
    const target: [number, number, number] = [fx + 10, fy, fz];
    const low = inThePit([fx - 4, fy + 5.6, fz], target);
    const { cursor } = low;
    expect(cursor.level).toBe('basement');
    expect(low.camera.position.y).toBeCloseTo(fy + 5.6, 6);
    for (const [mode, floor] of [
      ['upper', cutHeight('upper')! + CUT_CAMERA_CLEAR + ORBIT_CLEARANCE.cutClear],
      ['none', ORBIT_CLEARANCE.roofClear],
    ] as const) {
      cursor.choose(mode);
      expect(cursor.easing, mode).toBe(true);
      const before = cursor.level;
      const levels: string[] = [];
      let height = low.camera.position.y;
      let step = 0;
      for (let t = 0; t < FLOOR_VIEW.time + 0.2; t += 1 / 60) {
        cursor.frame(1 / 60);
        levels.push(cursor.level);
        step = Math.max(step, Math.abs(low.camera.position.y - height));
        height = low.camera.position.y;
      }
      // the level it showed until the camera cleared the new one's floor, then that one: never a jump down the limit
      const switched = levels.indexOf(mode);
      expect(switched, mode).toBeGreaterThan(0);
      expect(
        levels.slice(0, switched).every((level) => level === before),
        mode,
      ).toBe(true);
      expect(
        levels.slice(switched).every((level) => level === mode),
        mode,
      ).toBe(true);
      expect(height - fy, mode).toBeGreaterThanOrEqual(floor - 1e-6);
      expect(step, mode).toBeLessThan(0.35); // a few metres over 0.8 s at 60 frames a second, eased
      expect(Math.hypot(...low.orbit.target.toArray().map((v, k) => v - target[k]))).toBeLessThan(
        1e-9,
      ); // straight up round it
    }
  });

  it('keeps the level it shows when a press, a zoom or a drag ends a lift midway: never the whole house, never a jump', () => {
    const [fx, fy, fz] = HOUSE.focus;
    for (const interrupt of ['press', 'zoomed', 'start'] as const) {
      // low over the pit under "Basement", then "Upper floor", whose floor lies some 5 m higher, interrupted 0.3 s into the lift
      // (the camera some 7 m up, under the upper floor's cut and the roof's clearance), and "Upper floor" again
      const low = inThePit([fx - 4, fy + 5.6, fz], [fx + 10, fy, fz]);
      const { camera, orbit, cursor } = low;
      expect(cursor.level).toBe('basement');
      const levels: string[] = [];
      let at = camera.position.clone();
      let step = 0;
      const run = (seconds: number) => {
        for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
          cursor.frame(1 / 60);
          levels.push(cursor.level);
          step = Math.max(step, camera.position.distanceTo(at));
          at = camera.position.clone();
        }
      };
      cursor.choose('upper');
      run(0.3);
      expect(camera.position.y - fy, interrupt).toBeLessThan(
        cutHeight('upper')! + CUT_CAMERA_CLEAR,
      );
      if (interrupt === 'press') cursor.press(640, 400, true);
      else if (interrupt === 'zoomed') cursor.zoomed(640, 400);
      else orbit.dispatchEvent({ type: 'start' });
      expect(cursor.easing, interrupt).toBe(false);
      run(1);
      expect(cursor.level, interrupt).toBe('basement'); // what it showed, until the camera clears the upper floor's floor
      cursor.choose('upper'); // the same button again: on up to that floor
      expect(cursor.easing, interrupt).toBe(true);
      run(FLOOR_VIEW.time + 0.2);
      expect(cursor.level, interrupt).toBe('upper');
      expect(levels, interrupt).not.toContain('none');
      expect(step, interrupt).toBeLessThan(1);
    }
  });

  it('stops following OrbitControls once disposed', () => {
    const { camera, orbit } = setup({ position: [30, 30, 34], target: [4, 0, 4] });
    const cursor = createCursorOrbit(orbit, groundPick(camera), HOUSE);
    cursor.press(520, 470, true);
    cursor.dispose();
    orbit.rotateLeft(0.5);
    orbit.update();
    expect(orbit.target.toArray()).toEqual([4, 0, 4]);
  });
});
