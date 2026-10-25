import { describe, expect, it } from 'vitest';
import { DISTANCE, MIN_ASPECT, ORBIT, framingFit } from '../rig-math';
import { BLOOD_MOON, BOARD_UNDERSIDE, CLOUD_PEAK, LOTUS_LAKE } from './layout';
import {
  cloudPuffs,
  columnBounds,
  columnGeometry,
  inlayPlacements,
  lotusGeometry,
  motePlacements,
  seamGeometry,
  thinnedPuffs,
  type Column,
  type ColumnStyle,
} from './scenery';

type V = [number, number, number];
interface Solid {
  name: string;
  x: number;
  z: number;
  radius: number;
  top: number;
}

/**
 * Screens from a phone in a tall in-app browser to a wide monitor, and two narrower than the
 * rig's floor (MIN_ASPECT), which framingFit clamps to the floor's camera.
 */
const ASPECTS = [0.1, 0.25, MIN_ASPECT, 0.46, 0.6, 0.8, 1, 1.5, 2.4];
const FARTHEST = ORBIT.maxDistance * Math.max(...ASPECTS.map(framingFit));

/** Every camera the rig allows, sampled: zoom, height and a full turn round the board. */
function* cameras(): Generator<V> {
  for (const aspect of ASPECTS) {
    const fit = framingFit(aspect);
    for (const d of [ORBIT.minDistance, DISTANCE * fit, ORBIT.maxDistance * fit]) {
      for (let s = 0; s <= 24; s++) {
        const p = ORBIT.minPolar + ((ORBIT.maxPolar - ORBIT.minPolar) * s) / 24;
        for (let az = 0; az < 360; az += 4) {
          const a = (az * Math.PI) / 180;
          yield [d * Math.sin(p) * Math.sin(a), d * Math.cos(p), d * Math.sin(p) * Math.cos(a)];
        }
      }
    }
  }
}

/** What the player must always see: the board's corners and middle, and the kings' crowns. */
const TARGETS: V[] = [];
for (const x of [-4.4, 0, 4.4]) for (const z of [-4.4, 0, 4.4]) TARGETS.push([x, 0, z]);
for (const x of [-3.5, 0, 3.5]) for (const z of [-3.5, 0, 3.5]) TARGETS.push([x, 1.4, z]);

/** Whether the segment from `c` to `t` passes through `k`, a solid cylinder up to `k.top`. */
function blocks(c: V, t: V, k: Solid): boolean {
  const dx = t[0] - c[0];
  const dz = t[2] - c[2];
  const ox = c[0] - k.x;
  const oz = c[2] - k.z;
  const a = dx * dx + dz * dz;
  const b = 2 * (ox * dx + oz * dz);
  const cc = ox * ox + oz * oz - k.radius * k.radius;
  let t0 = 0;
  let t1 = 1;
  if (a < 1e-12) {
    if (cc >= 0) return false;
  } else {
    const disc = b * b - 4 * a * cc;
    if (disc <= 0) return false;
    t0 = Math.max(0, (-b - Math.sqrt(disc)) / (2 * a));
    t1 = Math.min(1, (-b + Math.sqrt(disc)) / (2 * a));
    if (t0 > t1) return false;
  }
  // Height is linear along the segment, so its lowest point inside the cylinder is an end.
  const y = Math.min(c[1] + (t[1] - c[1]) * t0, c[1] + (t[1] - c[1]) * t1);
  return y < k.top;
}

function solids(name: string, columns: Column[], style: ColumnStyle): Solid[] {
  return columns.map((c, i) => ({ name: `${name}[${i}]`, ...columnBounds(c, style) }));
}

/** The first camera, target and solid that hide part of the board, or null. */
function firstOcclusion(all: Solid[]) {
  for (const c of cameras()) {
    for (const t of TARGETS) {
      for (const k of all)
        if (blocks(c, t, k))
          return { camera: c.map((v) => +v.toFixed(2)), target: t, solid: k.name };
    }
  }
  return null;
}

describe('arena scenery never hides the board', () => {
  it('Jade Cloud Peak: the summit, the karst pillars and the far peaks', () => {
    const c = CLOUD_PEAK;
    const all = [
      ...solids('summit', [c.summit], c.summitStyle),
      ...solids('pillar', c.pillars, c.pillarStyle),
      ...solids('far', c.far, c.farStyle),
    ];
    expect(firstOcclusion(all)).toBeNull();
  });

  it('Blood Moon Abyss: the pillar and the spires', () => {
    const b = BLOOD_MOON;
    const all = [
      ...solids('pillar', [b.pillar], b.pillarStyle),
      ...solids('spire', b.spires, b.spireStyle),
    ];
    expect(firstOcclusion(all)).toBeNull();
  });

  it('the horizon walls stand beyond the farthest camera', () => {
    expect(Math.min(...BLOOD_MOON.canyon, ...LOTUS_LAKE.hills)).toBeGreaterThan(FARTHEST + 10);
  });

  it('the farthest camera is the one at the floor, however narrow the screen', () => {
    expect(FARTHEST).toBeCloseTo(ORBIT.maxDistance * framingFit(MIN_ASPECT));
    for (const aspect of [0.3, 0.2, 0.05, 0.01]) {
      expect(ORBIT.maxDistance * framingFit(aspect)).toBeLessThanOrEqual(FARTHEST);
    }
  });

  it('the check itself catches a pillar planted in front of the board', () => {
    const decoy: Solid = { name: 'decoy', x: 0, z: 9, radius: 1, top: 2 };
    expect(firstOcclusion([decoy])).not.toBeNull();
  });
});

describe('columnBounds', () => {
  it('holds every vertex of the column it describes', () => {
    const styles = [
      [CLOUD_PEAK.pillars, CLOUD_PEAK.pillarStyle],
      [CLOUD_PEAK.far, CLOUD_PEAK.farStyle],
      [BLOOD_MOON.spires, BLOOD_MOON.spireStyle],
      [[BLOOD_MOON.pillar], BLOOD_MOON.pillarStyle],
    ] as const;
    for (const [columns, style] of styles) {
      for (const c of columns) {
        const box = columnBounds(c, style);
        const pos = columnGeometry(c, style).getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          expect(Math.hypot(pos.getX(i) - box.x, pos.getZ(i) - box.z)).toBeLessThanOrEqual(
            box.radius + 1e-6,
          );
          expect(pos.getY(i)).toBeLessThanOrEqual(box.top + 1e-6);
        }
      }
    }
  });
});

describe('Jade Cloud Peak cloud sea', () => {
  it('keeps every puff below the dais, whatever way it turns to the camera', () => {
    const puffs = cloudPuffs(110, 21, 0, CLOUD_PEAK.cloudTop);
    expect(puffs).toHaveLength(110);
    for (const p of puffs)
      expect(p.y + p.height / 2).toBeLessThanOrEqual(CLOUD_PEAK.cloudTop + 1e-9);
    expect(CLOUD_PEAK.cloudTop).toBeLessThan(CLOUD_PEAK.summit.top);
  });

  it('thins out on a weak GPU without moving a single puff', () => {
    const high = cloudPuffs(140, 21, 0, CLOUD_PEAK.cloudTop);
    const low = thinnedPuffs(high, 56);
    expect(low).toHaveLength(56);
    // Every puff the low sea keeps is one of the high sea's, exactly where it was, once each.
    expect(new Set(low).size).toBe(56);
    for (const p of low) expect(high).toContain(p);
    // The collar round the summit's neck (the first 30%) and the open sea thin alike.
    const collar = (ps: typeof high) => ps.filter((p) => high.indexOf(p) < 140 * 0.3).length;
    expect(collar(low) / low.length).toBeCloseTo(collar(high) / high.length, 1);
    // Asking for as many as there are, or more, keeps them all.
    expect(thinnedPuffs(high, 140)).toEqual(high);
    expect(thinnedPuffs(high, 500)).toEqual(high);
  });

  it('is warmer on the side the sun shines from', () => {
    const puffs = cloudPuffs(200, 21, 0, CLOUD_PEAK.cloudTop);
    const sunward = puffs.filter((p) => p.x > 20);
    const away = puffs.filter((p) => p.x < -20);
    const warmth = (ps: typeof puffs) =>
      ps.reduce((s, p) => s + p.tint[0] - p.tint[2], 0) / ps.length;
    expect(warmth(sunward)).toBeGreaterThan(warmth(away));
  });
});

describe('drifting motes (embers, fireflies)', () => {
  it('a weak GPU draws the first of the same motes, so none of them moves', () => {
    const look = {
      count: { high: 130, low: 50 },
      seed: 71,
      radius: [5, 15] as [number, number],
      y: [-6.5, 11] as [number, number],
    };
    const high = motePlacements(look, look.count.high);
    const low = motePlacements(look, look.count.low);
    expect(high.position.subarray(0, low.position.length)).toEqual(low.position);
    expect(high.mote.subarray(0, low.mote.length)).toEqual(low.mote);
  });
});

describe('Blood Moon Abyss molten seams', () => {
  it('run along the square boundaries, inside the board', () => {
    const half = 0.07;
    const pos = seamGeometry(half, 0.004, 9).getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      expect(pos.getY(i)).toBeCloseTo(0.004);
      const onX = Math.abs(x - Math.round(x)) <= half + 1e-6 && Math.abs(z) <= 4 + 1e-6;
      const onZ = Math.abs(z - Math.round(z)) <= half + 1e-6 && Math.abs(x) <= 4 + 1e-6;
      expect(onX || onZ).toBe(true);
      expect(Math.max(Math.abs(x), Math.abs(z))).toBeLessThanOrEqual(4 + half + 1e-6);
    }
  });

  it('face up, so the camera above them sees them', () => {
    const g = seamGeometry(0.07, 0.004, 9).toNonIndexed();
    g.computeVertexNormals();
    const n = g.getAttribute('normal');
    for (let i = 0; i < n.count; i++) expect(n.getY(i)).toBeGreaterThan(0.99);
  });
});

describe('Lotus Moon Lake', () => {
  const [upper, lower] = LOTUS_LAKE.terraces;

  it('inlays the lotus on the frame and the terraces, never on a square', () => {
    for (const [x, , z, size] of inlayPlacements()) {
      const near = Math.max(Math.abs(x), Math.abs(z)) - size / 2;
      expect(near).toBeGreaterThanOrEqual(4);
      // Its farthest corner is still on stone.
      expect(Math.hypot(Math.abs(x) + size / 2, Math.abs(z) + size / 2)).toBeLessThanOrEqual(
        lower[0],
      );
    }
  });

  it('lays each inlay just above the surface under it', () => {
    // The frame's top (Board.tsx), then the upper terrace and the lower one.
    const tops = [-0.01, BOARD_UNDERSIDE, BOARD_UNDERSIDE - upper[1]];
    for (const [x, y, z, size] of inlayPlacements()) {
      const reach = Math.max(Math.abs(x), Math.abs(z)) + size / 2;
      const surface = reach <= 4.4 ? tops[0] : Math.hypot(x, z) <= upper[0] ? tops[1] : tops[2];
      expect(y - surface).toBeGreaterThan(0);
      expect(y - surface).toBeLessThan(0.01);
    }
  });

  it('floats the lotus on the water, clear of the terraces', () => {
    const { pads, flowers } = lotusGeometry(LOTUS_LAKE.clusters, LOTUS_LAKE.water);
    const edge = lower[0] * 1.015;
    for (const g of [pads, flowers]) {
      const pos = g.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        expect(Math.hypot(pos.getX(i), pos.getZ(i))).toBeGreaterThan(edge);
        expect(pos.getY(i)).toBeGreaterThan(LOTUS_LAKE.water);
        expect(pos.getY(i)).toBeLessThan(LOTUS_LAKE.water + 0.6);
      }
    }
    expect(upper[0]).toBeLessThan(lower[0]);
  });
});
