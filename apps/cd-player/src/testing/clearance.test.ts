import { Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  closestToCylinder,
  distanceTo,
  SURFACE_TOLERANCE,
  toRecord,
  toSleeve,
  type Cylinder,
  type Measure,
} from './clearance';
import { LUXE_RECORD } from './model-measures';

/** An upright cylinder off the origin, about as tall and as wide as Luxe's dancer's turn. */
const CYLINDER: Cylinder = { axis: [0.1, -0.2], radius: 0.03, bottom: 0.08, top: 0.2 };
const [AX, AZ] = CYLINDER.axis;
/** A sleeve's half thickness (vinyl.py's SLEEVE_T, 3 mm), as clearance.ts measures it. */
const SLEEVE_HALF_T = 0.0015;

/** An item's frame: where it stands, turned (Euler XYZ, radians) and scaled. */
function item(position: readonly number[], turn: readonly number[] = [0, 0, 0], scale = 1) {
  const object = new Object3D();
  object.position.set(position[0], position[1], position[2]);
  object.rotation.set(turn[0], turn[1], turn[2]);
  object.scale.setScalar(scale);
  object.updateMatrixWorld(true);
  return object;
}

/** A reading of a true distance on the safe side: never above it, at most the tolerance below. */
function expectSafe(reading: number, truth: number, at: string) {
  expect(reading, at).toBeLessThanOrEqual(truth + 1e-12);
  expect(reading, at).toBeGreaterThanOrEqual(truth - SURFACE_TOLERANCE - 1e-12);
}

describe('closestToCylinder', () => {
  it('reads a record’s and a sleeve’s distance from the cylinder on the safe side', () => {
    const half = LUXE_RECORD.half;
    const cases: [string, Object3D, Measure, number][] = [
      // A record lying flat beside it at mid height: rim to side along the line between the axes.
      ['a record beside it', item([AX + 0.2, 0.14, AZ]), toRecord, 0.2 - 0.15 - 0.03],
      // Half its size, the scale the rig sets on a copy shrinking away.
      [
        'a record at half size beside it',
        item([AX + 0.2, 0.14, AZ], [0, 0, 0], 0.5),
        toRecord,
        0.095,
      ],
      // Flat over its top, and under its bottom: face to end.
      ['a record over it', item([AX, 0.25, AZ]), toRecord, 0.25 - half - 0.2],
      ['a record under it', item([AX, 0.03, AZ]), toRecord, 0.08 - (0.03 + half)],
      // Over and beside it: the rim's lower edge to the top's rim.
      [
        'a record off its top edge',
        item([AX + 0.2, 0.25, AZ]),
        toRecord,
        Math.hypot(0.02, 0.25 - half - 0.2),
      ],
      // A sleeve standing up (its face turned to face +z), 50 mm from the axis: face to side.
      [
        'a sleeve facing it',
        item([AX, 0.14, AZ + 0.05], [Math.PI / 2, 0, 0]),
        toSleeve,
        0.05 - SLEEVE_HALF_T - 0.03,
      ],
      // The same sleeve edge on, its edge 10 mm off the side.
      [
        'a sleeve edge on',
        item([AX + 0.03 + 0.155 + 0.01, 0.14, AZ], [Math.PI / 2, 0, 0]),
        toSleeve,
        0.01,
      ],
    ];
    for (const [at, object, measure, truth] of cases) {
      expectSafe(closestToCylinder(CYLINDER, object, measure), truth, at);
    }
  });

  it('reads 0 for an item across it, and for one lying wholly inside it', () => {
    expect(closestToCylinder(CYLINDER, item([AX + 0.1, 0.14, AZ]), toRecord)).toBe(0);
    // A copy shrunk to a tenth (15 mm across its radius) inside the 30 mm cylinder: no point of the
    // surface is on it, but it is in the solid.
    expect(closestToCylinder(CYLINDER, item([AX, 0.14, AZ], [0, 0, 0], 0.1), toRecord)).toBe(0);
  });

  it('agrees with a dense sampling of its surface to within the tolerance, never above it', () => {
    // Its surface every half millimetre (by arc length on the side and round the ends): no point of
    // it stands more than SPACING / √2 from a sample, so the sampled least distance is the true one
    // or at most that much above it.
    const SPACING = 0.0005;
    const sampleError = SPACING / Math.SQRT2;
    const { radius, bottom, top } = CYLINDER;
    const turns = Math.ceil((2 * Math.PI * radius) / SPACING);
    const samples: Vector3[] = [];
    for (let i = 0; i < turns; i++) {
      const turn = (i / turns) * 2 * Math.PI;
      const [c, s] = [Math.cos(turn), Math.sin(turn)];
      for (let y = bottom; y <= top + 1e-12; y += SPACING) {
        samples.push(new Vector3(AX + radius * c, y, AZ + radius * s));
      }
      for (let r = 0; r <= radius + 1e-12; r += SPACING) {
        samples.push(new Vector3(AX + r * c, bottom, AZ + r * s));
        samples.push(new Vector3(AX + r * c, top, AZ + r * s));
      }
    }
    // A seeded generator, so every run poses the same items.
    let seed = 20261114;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    let compared = 0;
    let near = 0;
    while (compared < 32) {
      const position = [AX + (random() - 0.5) * 0.5, random() * 0.32, AZ + (random() - 0.5) * 0.5];
      // Its origin outside the cylinder: one inside reads 0, which the test above holds.
      const inside =
        Math.hypot(position[0] - AX, position[2] - AZ) <= radius &&
        position[1] >= bottom &&
        position[1] <= top;
      if (inside) continue;
      const turn = [random() * 2 * Math.PI, random() * 2 * Math.PI, random() * 2 * Math.PI];
      const object = item(position, turn, 0.3 + 0.7 * random());
      const measure = compared % 2 === 0 ? toRecord : toSleeve;
      const distance = distanceTo(object, measure, Infinity);
      let sampled = Infinity;
      for (const p of samples) sampled = Math.min(sampled, distance(p));
      const reading = closestToCylinder(CYLINDER, object, measure);
      const at = `item ${compared}, sampled ${sampled}`;
      expect(reading, at).toBeLessThanOrEqual(sampled + 1e-12);
      expect(reading, at).toBeGreaterThanOrEqual(sampled - sampleError - SURFACE_TOLERANCE - 1e-12);
      if (sampled > 0.002 && sampled < 0.05) near += 1;
      compared += 1;
    }
    // Some of them stand near it without touching it, where the reading counts.
    expect(near).toBeGreaterThan(4);
  });
});
