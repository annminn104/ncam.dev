import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import zonesPy from '../../art/blender/scripts/siteplan/zones.py?raw';
import sceneJson from '../../public/assets/scene.json?raw';
import { sceneSchema } from '../scene/schema';
import {
  cutHeight,
  CUT_CAMERA_CLEAR,
  CUT_DISTANCES,
  cutLevel,
  type CutLevel,
  nearHouse,
} from '../scene/cutaway';
import {
  clampTarget,
  cutFor,
  FLOOR_VIEW,
  floorPose,
  houseBounds,
  type HouseBounds,
  houseSpan,
  HOUSE_TOP,
  ISLAND_RIM,
  maxPolarFor,
  nearFor,
  ORBIT_CLEARANCE,
  ORBIT_LIMITS,
  orbitTarget,
  pivotShift,
  rimRadius,
  TARGET_MARGIN,
  wrapAngle,
  ZOOM_RISE,
  zoomToward,
} from './orbit';

/** Pose at `position` looking at `target` (no roll), as export_layout writes CAM_idle. */
function lookingAt(position: [number, number, number], target: [number, number, number]) {
  const forward = new Vector3(...target).sub(new Vector3(...position)).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), forward);
  return { position, rotation: [q.x, q.y, q.z, q.w] as [number, number, number, number] };
}

const scene = sceneSchema.parse(JSON.parse(sceneJson));
const houseSlot = scene.slots.find((slot) => slot.module === 'house')!;
const HOUSE: HouseBounds = houseBounds(houseSlot, scene.modules.house.footprint);
/** Where the orbit turns from CAM_idle (about (4, 0, 4)). */
const IDLE = orbitTarget(scene.camera.idle);

describe('orbitTarget', () => {
  it('is where the forward ray meets the ground plane', () => {
    const [x, y, z] = orbitTarget(lookingAt([3, 10, -4], [3, 0, -4.0001]));
    expect([x, y, z].map((v) => +v.toFixed(3))).toEqual([3, 0, -4]);
  });

  it('follows an oblique camera down to the ground, past what it looks at', () => {
    // The villa v2 idle camera: Blender (34.5, -40.5, 17.5) looking at (4, 3, 4) is glTF (34.5, 17.5, 40.5) -> (4, 4, -3).
    const pose = lookingAt([34.5, 17.5, 40.5], [4, 4, -3]);
    const target = new Vector3(...orbitTarget(pose));
    expect(target.y).toBeCloseTo(0, 6);
    const along = target
      .clone()
      .sub(new Vector3(...pose.position))
      .normalize();
    const forward = new Vector3(0, 0, -1).applyQuaternion(new Quaternion(...pose.rotation));
    expect(along.dot(forward)).toBeGreaterThan(0.99999);
    expect(target.x).toBeCloseTo(34.5 - 30.5 * (17.5 / 13.5), 3);
    expect(target.z).toBeCloseTo(40.5 - 43.5 * (17.5 / 13.5), 3);
  });

  it('falls back to the origin when the ray points up, sideways or away from the ground', () => {
    expect(orbitTarget(lookingAt([0, 5, 10], [0, 8, 0]))).toEqual([0, 0, 0]); // up
    expect(orbitTarget(lookingAt([0, 5, 10], [0, 5, 0]))).toEqual([0, 0, 0]); // level with the horizon
    expect(orbitTarget(lookingAt([0, -5, 10], [0, -8, 0]))).toEqual([0, 0, 0]); // under the ground, looking further down
  });
});

describe('ORBIT_LIMITS', () => {
  it('zooms between 14.5 and 140 m and tips a little below the horizon to see the rock underside', () => {
    // the closest zoom stays over the roof clearance, so a camera nearly overhead a target by the tall house clears it
    expect(ORBIT_LIMITS.minDistance).toBe(14.5);
    expect(ORBIT_LIMITS.minDistance).toBeGreaterThan(ORBIT_CLEARANCE.roofClear + 0.5);
    expect(ORBIT_LIMITS.maxDistance).toBe(140);
    expect(ORBIT_LIMITS.maxPolarAngle).toBeGreaterThan(Math.PI / 2);
    expect(ORBIT_LIMITS.maxPolarAngle).toBeLessThan(Math.PI / 2 + 0.5);
    expect(ORBIT_LIMITS.dampingFactor).toBeGreaterThan(0);
    expect(ORBIT_LIMITS.dampingFactor).toBeLessThan(1);
  });
});

/** A number or a pair of numbers given to a key of zones.py's ISLAND, e.g. `"exponent": 4.0`. */
function islandValue(key: string): number[] {
  const line = /^ISLAND = \{(.*)\}$/m.exec(zonesPy)?.[1];
  const match = line && new RegExp(`"${key}": (\\(([^)]*)\\)|[0-9.]+)`).exec(line);
  if (!match) throw new Error(`ISLAND["${key}"] not found in siteplan/zones.py`);
  return (match[2] ?? match[1]).split(',').map(Number);
}

describe('the island rim (ISLAND_RIM, rimRadius)', () => {
  it('is the superellipse siteplan/zones.py builds, on the yard footprint of scene.json', () => {
    expect([...ISLAND_RIM.size]).toEqual(islandValue('size'));
    expect(ISLAND_RIM.exponent).toBe(islandValue('exponent')[0]);
    expect(ISLAND_RIM.jitter).toBe(islandValue('jitter')[0]);
    expect([...ISLAND_RIM.size]).toEqual(scene.modules.yard.footprint);
  });

  it('runs along the half-sides less the jitter and stays within the island radius', () => {
    const [w, d] = ISLAND_RIM.size;
    const keep = 1 - ISLAND_RIM.jitter;
    expect(rimRadius(0)).toBeCloseTo((w / 2) * keep, 9);
    expect(rimRadius(Math.PI / 2)).toBeCloseTo((d / 2) * keep, 9);
    expect(rimRadius(Math.PI)).toBeCloseTo((w / 2) * keep, 9);
    // the rim's vertices (siteplan/island.py: `rim` of them, equally spaced from +X) before the jitter pulls them in
    const vertices = islandValue('rim')[0];
    let widest = 0;
    for (let k = 0; k < vertices; k++)
      widest = Math.max(widest, rimRadius((2 * Math.PI * k) / vertices) / keep);
    expect(widest).toBeGreaterThan(29.9); // the squircle's corners (siteplan/island.py: 29.96 m)
    expect(widest).toBeLessThanOrEqual(ORBIT_CLEARANCE.islandRadius);
  });
});

describe('clampTarget', () => {
  it('leaves a target inside the rim, less the margin, where it is', () => {
    expect(clampTarget([4, 0, 4])).toEqual([4, 0, 4]);
    expect(clampTarget([-15, 0, 12])).toEqual([-15, 0, 12]);
    expect(TARGET_MARGIN).toBeGreaterThanOrEqual(2);
  });

  it('pulls a target past it straight back towards the centre, onto the rim less the margin', () => {
    for (const [x, z] of [
      [40, 0],
      [0, -30],
      [-25, 20],
      [26, 21],
      [-26, -1],
    ]) {
      const [cx, cy, cz] = clampTarget([x, 0, z]);
      expect(cy).toBe(0);
      expect(Math.atan2(cz, cx)).toBeCloseTo(Math.atan2(z, x), 9);
      expect(Math.hypot(cx, cz)).toBeCloseTo(rimRadius(Math.atan2(z, x)) - TARGET_MARGIN, 9);
    }
  });

  it('never jumps: a target that moves 0.1 m moves its clamp by no more than that', () => {
    for (let a = 0; a < 2 * Math.PI; a += 0.05) {
      for (let r = 18; r < 34; r += 0.1) {
        const one = clampTarget([r * Math.cos(a), 0, r * Math.sin(a)]);
        const two = clampTarget([
          (r + 0.1) * Math.cos(a + 0.004),
          0,
          (r + 0.1) * Math.sin(a + 0.004),
        ]);
        expect(Math.hypot(one[0] - two[0], one[2] - two[2])).toBeLessThan(0.15);
      }
    }
  });
});

describe('ORBIT_CLEARANCE', () => {
  it("keeps the camera over the tall house's roof and its fittings with a margin", () => {
    expect(ORBIT_CLEARANCE.roofClear).toBeGreaterThan(HOUSE_TOP + 0.5);
    expect(ORBIT_CLEARANCE.roofClear).toBeLessThan(HOUSE_TOP + 1.5);
    // over the cut house the floors stay under the roof line: a cut only ever relaxes the limit
    expect(cutHeight('upper')! + CUT_CAMERA_CLEAR + ORBIT_CLEARANCE.cutClear).toBeLessThan(
      ORBIT_CLEARANCE.roofClear,
    );
  });
});

describe('houseBounds and houseSpan', () => {
  it('grow the house footprint of scene.json by the margin, and focus on its middle on the ground', () => {
    const [w, d] = scene.modules.house.footprint;
    const m = ORBIT_CLEARANCE.houseMargin;
    const [x, y, z] = houseSlot.position;
    expect(HOUSE.min[0]).toBeCloseTo(x - w / 2 - m, 9);
    expect(HOUSE.max[0]).toBeCloseTo(x + w / 2 + m, 9);
    expect(HOUSE.min[1]).toBeCloseTo(z - d / 2 - m, 9);
    expect(HOUSE.max[1]).toBeCloseTo(z + d / 2 + m, 9);
    expect(HOUSE.focus).toEqual([x, y, z]);
    expect(m).toBeGreaterThanOrEqual(1); // house.glb stays within its footprint; the margin is the camera's
  });

  it('bound a turned footprint by the box round its corners', () => {
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    const turned = houseBounds({ position: [5, 0, 0], rotation: [q.x, q.y, q.z, q.w] }, [20, 10]);
    const m = ORBIT_CLEARANCE.houseMargin;
    expect(turned.min[0]).toBeCloseTo(5 - 5 - m, 9);
    expect(turned.max[1]).toBeCloseTo(10 + m, 9);
  });

  it('span from no distance (the target inside) to its farthest corner, from the nearest side when outside', () => {
    const box: HouseBounds = { min: [-10, -15], max: [10, -2], focus: [0, 0, -8.5] };
    expect(houseSpan([0, 0, -8.5], box).near).toBe(0);
    expect(houseSpan([0, 0, -8.5], box).far).toBeCloseTo(Math.hypot(10, 6.5), 9);
    expect(houseSpan([0, 0, 4], box).near).toBeCloseTo(6, 9);
    expect(houseSpan([0, 0, 4], box).far).toBeCloseTo(Math.hypot(10, 19), 9);
    expect(houseSpan([14, 0, 2], box).near).toBeCloseTo(Math.hypot(4, 4), 9);
  });
});

const HORIZON = Math.PI / 2;
const LEVELS: CutLevel[] = ['none', 'upper', 'ground'];
/** The lowest the camera may be over the (grown) house while `level` shows: the roof line, or the cut's floor. */
const overHouse = (level: CutLevel) =>
  level === 'none'
    ? ORBIT_CLEARANCE.roofClear
    : cutHeight(level)! + CUT_CAMERA_CLEAR + ORBIT_CLEARANCE.cutClear;

/** Targets on a `step` m grid over the island, as clampTarget lets them be. */
function islandTargets(step: number): [number, number, number][] {
  const targets: [number, number, number][] = [];
  for (let x = -27; x <= 27; x += step) {
    for (let z = -23; z <= 23; z += step) {
      const clamped = clampTarget([x, 0, z]);
      if (clamped[0] === x && clamped[2] === z) targets.push(clamped);
    }
  }
  return targets;
}

/** `count` targets round the clamp's boundary, where the rig parks a target the cursor took past the rim (clampTarget). */
function rimTargets(count: number): [number, number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i * 2 * Math.PI) / count;
    return clampTarget([60 * Math.cos(angle), 0, 60 * Math.sin(angle)]);
  });
}

/** The camera `distance` from `target` at `polar` (from straight above) and `azimuth` (OrbitControls' theta). */
function cameraAt(
  target: readonly number[],
  distance: number,
  polar: number,
  azimuth: number,
): [number, number, number] {
  const h = distance * Math.sin(polar);
  return [
    target[0] + h * Math.sin(azimuth),
    target[1] + distance * Math.cos(polar),
    target[2] + h * Math.cos(azimuth),
  ];
}

/** Inside the box, more than a micrometre from its sides: the clearances may bring the camera right up to them. */
const inside = (box: HouseBounds, [x, , z]: readonly number[]) =>
  x > box.min[0] + 1e-6 && x < box.max[0] - 1e-6 && z > box.min[1] + 1e-6 && z < box.max[1] - 1e-6;

describe('maxPolarFor around a target anywhere on the island', () => {
  it('keeps the camera out of the house, the trees and the rock and over the grass, whatever the angle', () => {
    const { islandRadius, margin, lawnClear } = ORBIT_CLEARANCE;
    const azimuths = Array.from({ length: 36 }, (_, i) => (i * 2 * Math.PI) / 36);
    let checked = 0;
    for (const target of [...islandTargets(3), ...rimTargets(48)]) {
      for (let d = ORBIT_LIMITS.minDistance; d <= ORBIT_LIMITS.maxDistance; d += 0.5) {
        for (const level of LEVELS) {
          const limit = maxPolarFor(d, level, target, HOUSE);
          for (const polar of [limit, 0.85 * limit, 0.6 * limit]) {
            for (const azimuth of azimuths) {
              const position = cameraAt(target, d, polar, azimuth);
              const altitude = position[1];
              const fromCentre = Math.hypot(position[0], position[2]);
              const where = `${level} at ${d} m from (${target[0]}, ${target[2]}), polar ${polar.toFixed(3)}, azimuth ${azimuth.toFixed(2)}`;
              // over the house: above its roof line, or above the floor of the cut on show
              if (inside(HOUSE, position) && altitude < overHouse(level) - 1e-9)
                expect.fail(`in the house: ${where}`);
              // over the island: above its trees; under the ground plane only well beyond its rim and rock
              if (fromCentre <= islandRadius && altitude < lawnClear - 1e-9)
                expect.fail(`in the garden: ${where}`);
              if (altitude < 0 && fromCentre < islandRadius + margin - 1e-9)
                expect.fail(`in the rock: ${where}`);
              checked += 1;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1e6);
  }, 60_000);

  it('changes smoothly with the distance, so a zoom lifts or lowers the camera without a jump', () => {
    for (const target of [...islandTargets(6), ...rimTargets(24)]) {
      for (const level of LEVELS) {
        let previous = maxPolarFor(ORBIT_LIMITS.minDistance, level, target, HOUSE);
        for (let d = ORBIT_LIMITS.minDistance + 0.1; d <= ORBIT_LIMITS.maxDistance; d += 0.1) {
          const phi = maxPolarFor(d, level, target, HOUSE);
          // Where a floor holds the camera nearly overhead (within 3.5 m of the roof clearance, more than 0.7 of the
          // distance up: the roof line from a target by the house) the angle has to turn faster to keep the camera at
          // its height, however smooth the floor: acos(13.7 / d) alone turns 0.02 rad between 14.6 and 14.5 m.
          const overhead =
            d < ORBIT_CLEARANCE.roofClear + 3.5 && Math.cos(Math.max(phi, previous)) > 0.7;
          if (Math.abs(phi - previous) >= (overhead ? 0.03 : 0.0125)) {
            expect.fail(
              `${level} at ${d.toFixed(1)} m from (${target[0].toFixed(2)}, ${target[2].toFixed(2)}): ${Math.abs(phi - previous).toFixed(4)} rad`,
            );
          }
          previous = phi;
        }
      }
    }
  }, 30_000);

  it('changes smoothly with the target, so a zoom or a turn that moves it does not jump the camera', () => {
    for (const target of [...islandTargets(4), ...rimTargets(24)]) {
      for (const level of LEVELS) {
        for (let d = ORBIT_LIMITS.minDistance; d <= 80; d += 0.5) {
          const phi = maxPolarFor(d, level, target, HOUSE);
          for (const [dx, dz] of [
            [0.1, 0],
            [0, 0.1],
            [0.07, -0.07],
            [-0.1, 0],
            [0, -0.1],
          ]) {
            const moved = maxPolarFor(d, level, [target[0] + dx, 0, target[2] + dz], HOUSE);
            if (Math.abs(moved - phi) >= 0.0125) {
              expect.fail(
                `${level} at ${d} m from (${target[0].toFixed(2)}, ${target[2].toFixed(2)}) + (${dx}, ${dz}): ${Math.abs(moved - phi).toFixed(4)} rad`,
              );
            }
          }
        }
      }
    }
  }, 30_000);

  it('lifts or lowers the camera on the limit by at most about 2 m per metre of zoom or of target move', () => {
    // The floors' own slopes: the roof line's tangent (hypot(near, roofClear) / roofClear: 2.04 from the island's far end),
    // its easing past the far corner (1.25), the lawn's (0.83). Past the dip the limit tips the camera below the horizon
    // instead, at under 0.0035 rad per 0.1 m (the distance test above).
    const { islandRadius, margin } = ORBIT_CLEARANCE;
    const height = (d: number, level: CutLevel, target: readonly number[]) =>
      d * Math.cos(maxPolarFor(d, level, target, HOUSE));
    for (const target of [...islandTargets(4), ...rimTargets(24)]) {
      const dip = islandRadius + Math.hypot(target[0], target[2]) + margin;
      const where = (level: CutLevel, d: number) =>
        `${level} at ${d.toFixed(1)} m from (${target[0].toFixed(2)}, ${target[2].toFixed(2)})`;
      for (const level of LEVELS) {
        for (let d = ORBIT_LIMITS.minDistance; d + 0.1 <= dip; d += 0.1) {
          const rise = Math.abs(height(d + 0.1, level, target) - height(d, level, target));
          if (rise > 0.21)
            expect.fail(`${where(level, d)}: ${(rise * 10).toFixed(2)} m per m of zoom`);
        }
        for (let d = ORBIT_LIMITS.minDistance; d + 0.2 <= dip; d += 0.5) {
          for (const [dx, dz] of [
            [0.1, 0],
            [0, 0.1],
            [0.07, -0.07],
            [-0.1, 0],
            [0, -0.1],
          ]) {
            const rise = Math.abs(
              height(d, level, [target[0] + dx, 0, target[2] + dz]) - height(d, level, target),
            );
            if (rise > 0.21)
              expect.fail(
                `${where(level, d)} + (${dx}, ${dz}): ${(rise * 10).toFixed(2)} m per m of target move`,
              );
          }
        }
      }
    }
    // the vegetable garden from 16.8 m, on the limit: a 5 % wheel notch out lifts the camera 1.2 m over what the dolly
    // does (the old floor, sqrt(d² - near²), lifted it 2.6 m)
    const veg: [number, number, number] = [-19, 0, 14];
    const lift = height(16.8 / 0.95, 'none', veg) - height(16.8, 'none', veg) / 0.95;
    expect(lift).toBeLessThan(1.3);
  }, 30_000);

  it('keeps the camera above the cut while it could be over the house, so the cut stays on', () => {
    for (const level of ['upper', 'ground'] as const) {
      const floor = cutHeight(level)! + CUT_CAMERA_CLEAR + ORBIT_CLEARANCE.cutClear;
      for (const target of [HOUSE.focus, IDLE, [6, 0, 0], [-12, 0, -9]]) {
        for (let d = ORBIT_LIMITS.minDistance; d <= 40; d += 0.1) {
          const phi = maxPolarFor(d, level, target, HOUSE);
          const { near, far } = houseSpan(target, HOUSE);
          const horizontal = d * Math.sin(phi);
          if (horizontal >= near && horizontal <= far)
            expect(d * Math.cos(phi), `${level} at ${d} m`).toBeGreaterThanOrEqual(floor - 1e-9);
          // and the cut only ever relaxes the limit: never higher than the whole house would hold it
          expect(phi).toBeGreaterThanOrEqual(maxPolarFor(d, 'none', target, HOUSE) - 1e-12);
        }
      }
    }
    expect(maxPolarFor(16, 'ground', HOUSE.focus, HOUSE)).toBeGreaterThan(
      maxPolarFor(16, 'none', HOUSE.focus, HOUSE) + 0.25,
    );
  });

  it('does not jump when the cut changes at a hysteresis edge, measured from the house however far the target is', () => {
    // the cut follows the camera's distance to the house (cutFor), which is within the target's distance from the house
    // of the orbit distance: at a switch the two levels' limits agree
    const { upper, ground, hysteresis } = CUT_DISTANCES;
    for (const target of [HOUSE.focus, IDLE, [-19, 0, 14], [12, 0, 6]]) {
      const offset = Math.hypot(target[0] - HOUSE.focus[0], target[2] - HOUSE.focus[2]);
      for (const [from, to, edge] of [
        ['ground', 'upper', ground + hysteresis],
        ['upper', 'none', upper + hysteresis],
      ] as const) {
        for (
          let d = Math.max(ORBIT_LIMITS.minDistance, edge - offset);
          d <= edge + offset;
          d += 0.25
        ) {
          expect(maxPolarFor(d, from, target, HOUSE), `${from} -> ${to} at ${d} m`).toBeCloseTo(
            maxPolarFor(d, to, target, HOUSE),
            9,
          );
        }
      }
    }
  });

  it('dips below the horizon only once the camera is outside the island even from this target', () => {
    const { islandRadius, margin } = ORBIT_CLEARANCE;
    for (const target of islandTargets(5)) {
      const dip = islandRadius + Math.hypot(target[0], target[2]) + margin;
      for (let d = ORBIT_LIMITS.minDistance; d <= dip; d += 0.25)
        expect(maxPolarFor(d, 'none', target, HOUSE)).toBeLessThanOrEqual(HORIZON);
      expect(maxPolarFor(dip + 10, 'none', target, HOUSE)).toBeCloseTo(
        ORBIT_LIMITS.maxPolarAngle,
        9,
      );
    }
    expect(maxPolarFor(55, 'none', IDLE, HOUSE)).toBeGreaterThan(HORIZON);
    for (const d of [60, 80, 115, ORBIT_LIMITS.maxDistance]) {
      expect(maxPolarFor(d, 'none', IDLE, HOUSE)).toBeCloseTo(ORBIT_LIMITS.maxPolarAngle, 9);
    }
  });

  it('lets the camera down to the grass and the garden near a target away from the house', () => {
    // the vegetable garden from 12 m: lower than the roof line, but over the trees
    const veg: [number, number, number] = [-19, 0, 14];
    const altitude = 12 * Math.cos(maxPolarFor(12, 'none', veg, HOUSE));
    expect(altitude).toBeCloseTo(ORBIT_CLEARANCE.lawnClear, 6);
    expect(altitude).toBeGreaterThan(3.6); // the tree canopies
    // the house holds it over the roof line once it could reach the house
    expect(28 * Math.cos(maxPolarFor(28, 'none', veg, HOUSE))).toBeGreaterThanOrEqual(
      ORBIT_CLEARANCE.roofClear - 1e-9,
    );
  });

  it('is nearly overhead at the closest zoom onto the house, as before', () => {
    expect(maxPolarFor(ORBIT_LIMITS.minDistance, 'none', HOUSE.focus, HOUSE)).toBeLessThan(0.5);
    for (let d = ORBIT_LIMITS.minDistance; d <= 20; d += 0.1) {
      expect(d * Math.cos(maxPolarFor(d, 'none', HOUSE.focus, HOUSE))).toBeGreaterThanOrEqual(
        HOUSE_TOP,
      );
    }
  });

  it('is no tighter than the limit it replaces around the old targets, but where the trees now hold the camera up', () => {
    // maxPolarFor before the cursor moved the target (orbit target within 8 m of the centre, the house's far corner
    // within 8 m more than its footprint's from the centre: 26 m for the glass villa), for the house of scene.json
    const [w, d] = scene.modules.house.footprint;
    const [sx, , sz] = houseSlot.position;
    const reach =
      8 +
      Math.max(
        ...[-1, 1].flatMap((i) =>
          [-1, 1].map((j) => Math.hypot(sx + (i * w) / 2, sz + (j * d) / 2)),
        ),
      );
    const roof = ORBIT_CLEARANCE.roofClear;
    const legacy = (distance: number, level: CutLevel) => {
      const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
      const cut = (l: 'upper' | 'ground') => cutHeight(l)! + CUT_CAMERA_CLEAR + 1.5;
      const whole = roof + (1.5 - roof) * clamp01((distance - Math.hypot(reach, roof)) / 8);
      const band = clamp01((distance - 25) / 6);
      const cutFloor =
        level === 'upper' ? cut('upper') : cut('ground') + (cut('upper') - cut('ground')) * band;
      const floor = level === 'none' ? whole : Math.min(whole, cutFloor);
      const above = Math.acos(Math.min(1, floor / distance));
      return above + (Math.PI / 2 + 0.3 - above) * clamp01((distance - 41) / 10);
    };
    // CAM_idle's ground point from afar, the house focus close up (the cut's bands are measured from it)
    for (const [target, levels] of [
      [IDLE, ['none']],
      [[sx, 0, sz], LEVELS],
    ] as const) {
      for (const level of levels) {
        for (let d = ORBIT_LIMITS.minDistance; d <= ORBIT_LIMITS.maxDistance; d += 0.1) {
          const now = maxPolarFor(d, level, target, HOUSE);
          const before = legacy(d, level);
          if (now >= before - 1e-9) continue;
          // tighter only where the old limit let the camera under the tree tops over the island's edge (34-41 m)
          expect(d, `${level} at ${d.toFixed(1)} m`).toBeGreaterThan(33);
          expect(d * Math.cos(before)).toBeLessThan(ORBIT_CLEARANCE.lawnClear);
          expect(before - now).toBeLessThan(0.08); // under 5 degrees
        }
      }
    }
  });
});

describe('cutFor', () => {
  it("cuts by the camera's distance to the house, not to the orbit target", () => {
    const [fx, fy, fz] = HOUSE.focus;
    // 20 m over the house, whatever the target: the ground floor
    expect(cutFor([fx, fy + 18, fz + 8.7], HOUSE, 'none')).toBe('ground');
    // close to the vegetable garden but 40 m from the house: the roof goes, the upper floor stays
    expect(cutFor([-19, 14, 26], HOUSE, 'none')).toBe(
      cutLevel(Math.hypot(-19 - fx, 14 - fy, 26 - fz), 14 - fy, 'none'),
    );
    expect(cutFor([-30, 14, 30], HOUSE, 'none')).toBe('none');
  });

  it("keeps cutLevel's thresholds, hysteresis and camera height rule", () => {
    const [fx, fy, fz] = HOUSE.focus;
    const at = (distance: number, height = 0.6) => [
      fx,
      fy + distance * height,
      fz + distance * Math.sqrt(1 - height * height),
    ];
    expect(cutFor(at(43), HOUSE, 'none')).toBe('none');
    expect(cutFor(at(41.9), HOUSE, 'none')).toBe('upper');
    expect(cutFor(at(47.9), HOUSE, 'upper')).toBe('upper');
    expect(cutFor(at(30.9), HOUSE, 'ground')).toBe('ground');
    expect(cutFor(at(20, 0.1), HOUSE, 'none')).toBe('none'); // 2 m up: under the cut's camera clearance
  });
});

describe("nearFor: the camera near the house, close enough to make out the interior's details", () => {
  const [fx, fy, fz] = HOUSE.focus;
  const at = (distance: number, height = 0.6) => [
    fx,
    fy + distance * height,
    fz + distance * Math.sqrt(1 - height * height),
  ];

  it("measures from the house focus like cutFor, but whatever the camera's height and the cut", () => {
    expect(nearFor(at(20, 0.1), HOUSE, false)).toBe(true); // 2 m up: the house whole ("Mái" or too low to cut), still near
    expect(nearFor(at(20), HOUSE, false)).toBe(true);
    expect(nearFor([-30, 14, 30], HOUSE, false)).toBe(false); // by the vegetable garden, far from the house
    expect(nearFor(scene.camera.idle.position, HOUSE, false)).toBe(false); // the site's first view
  });

  it('starts within CUT_DISTANCES.upper and holds CUT_DISTANCES.hysteresis either side of it, as the upper cut does', () => {
    expect(nearFor(at(43), HOUSE, false)).toBe(false);
    expect(nearFor(at(41.9), HOUSE, false)).toBe(true);
    expect(nearFor(at(47.9), HOUSE, true)).toBe(true);
    expect(nearFor(at(48.1), HOUSE, true)).toBe(false);
    expect(nearFor(at(43), HOUSE, true)).toBe(nearHouse(43, true));
  });
});

describe('the floor buttons and the basement\'s cut (villa v2 spec §12 "Tầng hầm")', () => {
  it('cutFor takes the mode: a level picked holds whatever the distance, as long as the camera clears its cut', () => {
    const [fx, fy, fz] = HOUSE.focus;
    expect(cutFor([fx + 60, fy + 40, fz + 60], HOUSE, 'none', 'ground')).toBe('ground');
    expect(cutFor([fx, fy + 18, fz + 8.7], HOUSE, 'none', 'none')).toBe('none'); // the roof button: the whole house
    expect(cutFor([fx, fy + 18, fz + 8.7], HOUSE, 'none', 'basement')).toBe('basement');
    expect(cutFor([fx + 30, fy + 6, fz + 30], HOUSE, 'none', 'upper')).toBe('none'); // under the upper cut's clearance
    expect(cutFor([fx, fy + 18, fz + 8.7], HOUSE, 'none', 'auto')).toBe('ground');
    expect(cutFor([fx, fy + 18, fz + 8.7], HOUSE, 'none')).toBe('ground'); // auto by default
  });

  it("keeps the camera over the house under the basement's cut as high as under the ground floor's: leaving it never jumps", () => {
    // 5.55 m over the house's ground near it, the ground floor cut's floor: "Tầng 1" takes over from a low "Hầm" view
    // where it stands; it may still look down into the pit from there
    const floor = cutHeight('ground')! + CUT_CAMERA_CLEAR + ORBIT_CLEARANCE.cutClear;
    expect(floor).toBeCloseTo(5.55, 9);
    for (const target of [HOUSE.focus, IDLE, [-4.5, 0, 0]]) {
      for (let d = ORBIT_LIMITS.minDistance; d <= 30; d += 0.1) {
        const phi = maxPolarFor(d, 'basement', target, HOUSE);
        // it only ever relaxes the ground floor's limit
        expect(phi).toBeGreaterThanOrEqual(maxPolarFor(d, 'ground', target, HOUSE) - 1e-12);
        const { near, far } = houseSpan(target, HOUSE);
        const horizontal = d * Math.sin(phi);
        if (horizontal >= near && horizontal <= far)
          expect(d * Math.cos(phi), `${d} m`).toBeGreaterThanOrEqual(floor - 1e-9);
      }
    }
    const ground = 20 * Math.cos(maxPolarFor(20, 'ground', HOUSE.focus, HOUSE));
    const basement = 20 * Math.cos(maxPolarFor(20, 'basement', HOUSE.focus, HOUSE));
    expect(basement).toBeCloseTo(ground, 9);
    expect(basement).toBeCloseTo(floor, 9);
  });
});

describe('floorPose: where a floor button takes the camera (interaction spec §2)', () => {
  const DEG = Math.PI / 180;
  /** The camera of CAM_idle, the site's first view: 110 m from the house, 13.8 degrees down onto it. */
  const idleCamera = [...scene.camera.idle.position] as [number, number, number];
  const [fx, fy, fz] = HOUSE.focus;
  /** A camera `distance` from `target`, `height` over it, on the side the island's front looks from. */
  const over = (
    target: readonly number[],
    distance: number,
    height: number,
  ): [number, number, number] => {
    const across = Math.sqrt(distance * distance - height * height);
    return [
      target[0] + across * Math.sin(0.6),
      target[1] + height,
      target[2] + across * Math.cos(0.6),
    ];
  };

  it('brings a far or low camera to the house: 35 m from its focus, 55 degrees down into the pit, 40 onto a storey, the azimuth kept', () => {
    expect(FLOOR_VIEW.far).toBe(45);
    expect(FLOOR_VIEW.steep).toBeCloseTo(35 * DEG, 9);
    expect(FLOOR_VIEW.time).toBeCloseTo(0.8, 9);
    const azimuth = Math.atan2(idleCamera[0] - fx, idleCamera[2] - fz);
    for (const [mode, down] of [
      ['basement', 55],
      ['ground', 40],
      ['upper', 40],
    ] as const) {
      const pose = floorPose(mode, idleCamera, IDLE, HOUSE, 'none');
      expect(pose, mode).not.toBeNull();
      expect(pose!.target).toEqual([fx, fy, fz]);
      expect(pose!.distance).toBe(FLOOR_VIEW.distance);
      expect(pose!.polar).toBeCloseTo(Math.PI / 2 - down * DEG, 9);
      expect(pose!.azimuth).toBeCloseTo(azimuth, 9);
    }
    // close but low: 30 m out, 25 degrees down onto the house
    const low = over(HOUSE.focus, 30, 30 * Math.sin(25 * DEG));
    expect(floorPose('basement', low, HOUSE.focus, HOUSE, 'upper')?.distance).toBe(
      FLOOR_VIEW.distance,
    );
  });

  it('leaves a camera that already looks down at the house from near enough where it is, and "Mái" and "Tự động" from afar', () => {
    const near = over(HOUSE.focus, 30, 30 * Math.sin(60 * DEG));
    for (const mode of ['basement', 'ground', 'upper', 'none', 'auto'] as const) {
      expect(floorPose(mode, near, HOUSE.focus, HOUSE, 'ground'), mode).toBeNull();
    }
    expect(floorPose('none', idleCamera, IDLE, HOUSE, 'none')).toBeNull();
    expect(floorPose('auto', idleCamera, IDLE, HOUSE, 'none')).toBeNull();
    expect(floorPose('basement', idleCamera, IDLE, null, 'none')).toBeNull(); // no house to go to
  });

  it("lifts a camera under the floor of the level picked straight up round its target, to just inside that level's limit", () => {
    // low over the pit's west half on the basement's camera floor, looking down at the house steeply (54 degrees over its
    // focus), the orbit turning round a point by the karaoke 14.6 m away
    const target: [number, number, number] = [fx + 9.5, fy, fz];
    const camera: [number, number, number] = [fx - 4, fy + 5.6, fz];
    const distance = Math.hypot(13.5, 5.6);
    const polar = Math.acos(5.6 / distance);
    const azimuth = Math.atan2(camera[0] - target[0], camera[2] - target[2]);
    expect(floorPose('ground', camera, target, HOUSE, 'basement')).toBeNull(); // its floor is the basement's
    expect(floorPose('auto', camera, target, HOUSE, 'basement')).toBeNull(); // the ground floor's by distance
    for (const [mode, height] of [
      ['upper', cutHeight('upper')! + CUT_CAMERA_CLEAR + ORBIT_CLEARANCE.cutClear],
      ['none', ORBIT_CLEARANCE.roofClear],
    ] as const) {
      const pose = floorPose(mode, camera, target, HOUSE, 'basement');
      expect(pose, mode).not.toBeNull();
      expect(pose!.target).toEqual(target);
      expect(pose!.distance).toBeCloseTo(distance, 9);
      expect(pose!.azimuth).toBeCloseTo(azimuth, 9);
      expect(pose!.polar).toBeLessThan(polar);
      expect(pose!.polar).toBeLessThanOrEqual(maxPolarFor(distance, mode, target, HOUSE));
      expect(distance * Math.cos(pose!.polar), mode).toBeGreaterThanOrEqual(height - 1e-9);
      expect(distance * Math.cos(pose!.polar), mode).toBeLessThan(height + 0.5); // just over it: a lift, not a new view
    }
  });
});

describe('wrapAngle', () => {
  it('brings an angle into (-pi, pi]', () => {
    expect(wrapAngle(0.3)).toBeCloseTo(0.3, 12);
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(2 * Math.PI + 0.1)).toBeCloseTo(0.1, 12);
    expect(wrapAngle(-3 * Math.PI + 0.2)).toBeCloseTo(-Math.PI + 0.2, 12);
  });
});

describe('pivotShift', () => {
  const turn = (v: Vector3, centre: Vector3, angle: number) =>
    v
      .clone()
      .sub(centre)
      .applyAxisAngle(new Vector3(0, 1, 0), angle)
      .add(centre);

  it('turns the camera and the target round the vertical through the pivot instead of the target', () => {
    const target = new Vector3(4, 0, 4);
    const pivot = new Vector3(9, -0.3, 11); // the pond's water
    const camera = new Vector3(40, 25, 50);
    for (const angle of [0.01, 0.4, -1.2, 3]) {
      // OrbitControls turned the camera round the target; the shift moves both
      const shift = new Vector3(...pivotShift(pivot.toArray(), target.toArray(), angle));
      expect(shift.y).toBe(0); // the target stays on the ground
      const moved = turn(camera, target, angle).add(shift);
      expect(moved.distanceTo(turn(camera, pivot, angle))).toBeLessThan(1e-9);
      expect(
        target
          .clone()
          .add(shift)
          .distanceTo(turn(target, pivot, angle)),
      ).toBeLessThan(1e-9);
      // the pivot keeps its place relative to the camera's turned frame: it stays put on screen
      const seen = pivot
        .clone()
        .sub(moved)
        .applyAxisAngle(new Vector3(0, 1, 0), -angle);
      expect(seen.distanceTo(pivot.clone().sub(camera))).toBeLessThan(1e-9);
    }
  });

  it('is no shift when the pivot is the target or the turn is nothing', () => {
    expect(pivotShift([4, 0, 4], [4, 0, 4], 0.7).map(Math.abs)).toEqual([0, 0, 0]);
    expect(pivotShift([9, 1, 11], [4, 0, 4], 0).map(Math.abs)).toEqual([0, 0, 0]);
  });
});

describe('zoomToward', () => {
  /** OrbitControls' dolly: the camera `scale` times as far from the target, on the same line. */
  const dolly = (camera: readonly number[], target: readonly number[], scale: number) =>
    new Vector3(...camera)
      .sub(new Vector3(...target))
      .multiplyScalar(scale)
      .add(new Vector3(...target));
  const target: [number, number, number] = [4, 0, 4];
  const camera: [number, number, number] = [30, 30, 34];

  it('scales camera and target about a point on the ground: it stays under the cursor and the target on the ground', () => {
    const point: [number, number, number] = [-6, 0, 10];
    for (const scale of [0.95, 0.6, 1 / 0.95, 1.5]) {
      const zoom = zoomToward(dolly(camera, target, scale).toArray(), target, point, scale);
      const expected = new Vector3(...point).add(
        new Vector3(...camera).sub(new Vector3(...point)).multiplyScalar(scale),
      );
      expect(new Vector3(...zoom.camera).distanceTo(expected)).toBeLessThan(1e-9);
      expect(zoom.target[1]).toBeCloseTo(0, 12);
      const scaled = new Vector3(...point).add(
        new Vector3(...target).sub(new Vector3(...point)).multiplyScalar(scale),
      );
      expect(new Vector3(...zoom.target).distanceTo(scaled)).toBeLessThan(1e-9);
    }
  });

  it('keeps a point above the ground under the cursor: the target slides along the line of sight back onto the ground', () => {
    const point: [number, number, number] = [0, 7, -6]; // on the roof
    const line = new Vector3(...target).sub(new Vector3(...camera)).normalize();
    const toPoint = new Vector3(...point).sub(new Vector3(...camera)).normalize();
    for (const scale of [0.9, 1.2]) {
      const zoom = zoomToward(dolly(camera, target, scale).toArray(), target, point, scale);
      const at = new Vector3(...zoom.camera);
      // the camera on its way to (or from) the point, looking the same way
      expect(new Vector3(...point).sub(at).normalize().dot(toPoint)).toBeGreaterThan(1 - 1e-12);
      expect(at.distanceTo(new Vector3(...point))).toBeCloseTo(
        scale * new Vector3(...camera).distanceTo(new Vector3(...point)),
        9,
      );
      expect(new Vector3(...zoom.target).sub(at).normalize().dot(line)).toBeGreaterThan(1 - 1e-12);
      expect(zoom.target[1]).toBeCloseTo(0, 12);
    }
  });

  it('goes all the way in one long step onto the roof, as in many short ones', () => {
    const point: [number, number, number] = [0, 7.5, -8]; // the roof, from CAM_idle's height
    const high: [number, number, number] = [72.5, 29.6, 85.6];
    const idle: [number, number, number] = [4, 0, 4];
    const long = zoomToward(dolly(high, idle, 0.3).toArray(), idle, point, 0.3);
    let camera = high;
    let target = idle;
    for (let i = 0; i < 20; i++) {
      const step = zoomToward(
        dolly(camera, target, 0.3 ** (1 / 20)).toArray(),
        target,
        point,
        0.3 ** (1 / 20),
      );
      camera = step.camera;
      target = step.target;
    }
    expect(new Vector3(...long.camera).distanceTo(new Vector3(...camera))).toBeLessThan(1e-6);
    expect(new Vector3(...long.target).distanceTo(new Vector3(...target))).toBeLessThan(1e-6);
  });

  it("goes part of the way onto a point higher over the target than most of the camera's height (a low view)", () => {
    const low: [number, number, number] = [40, 1.5, 4]; // 36 m out at lawn height
    const point: [number, number, number] = [6, 4, 4]; // 2.7 times as high
    const dollied = dolly(low, target, 0.8);
    const zoom = zoomToward(dollied.toArray(), target, point, 0.8);
    // the target slid no further than for a point ZOOM_RISE of the camera's height up: the zoom still brings it closer
    const distance = new Vector3(...zoom.camera).distanceTo(new Vector3(...zoom.target));
    expect(distance).toBeLessThanOrEqual(Math.hypot(36, 1.5) * (0.8 + 0.2 * ZOOM_RISE) + 1e-9);
    expect(ZOOM_RISE).toBeLessThan(1);
    expect(zoom.target[1]).toBeCloseTo(0, 12);
    // the camera went some of the way the full step would take it towards the point, not all of it
    const full = new Vector3(...point).sub(new Vector3(...target)).multiplyScalar(0.2);
    const went = new Vector3(...zoom.camera).sub(dollied);
    expect(went.clone().normalize().dot(full.clone().normalize())).toBeGreaterThan(1 - 1e-12);
    expect(went.length()).toBeGreaterThan(0.1 * full.length());
    expect(went.length()).toBeLessThan(0.9 * full.length());
  });

  it('stops the target at the rim less the margin: the rest of the step is a plain dolly', () => {
    const point: [number, number, number] = [-80, 0, 4]; // past the rim, in the air
    const zoom = zoomToward(dolly(camera, target, 0.5).toArray(), target, point, 0.5);
    const [x, , z] = zoom.target;
    expect(Math.hypot(x, z)).toBeLessThanOrEqual(
      rimRadius(Math.atan2(z, x)) - TARGET_MARGIN + 1e-6,
    );
    expect(Math.hypot(x, z)).toBeGreaterThan(rimRadius(Math.atan2(z, x)) - TARGET_MARGIN - 0.01); // as far as it may
    expect(zoom.target[1]).toBeCloseTo(0, 12);
  });

  it('leaves a level view as the dolly made it', () => {
    const level: [number, number, number] = [44, 0, 4];
    const moved = dolly(level, target, 0.9).toArray();
    expect(zoomToward(moved, target, [0, 5, 4], 0.9)).toEqual({ camera: moved, target });
  });
});
