import type { PieceSymbol } from 'chess.js';
import { Vector3 } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { disposeOwned } from '../dispose';
import {
  BASE_TOP,
  GLYPH,
  TREASURE_HEIGHT,
  TREASURE_RADIUS,
  baseKit,
  pearlKit,
  restPose,
  sealKit,
} from './kits';

const LADDER: PieceSymbol[] = ['p', 'n', 'b', 'r', 'q', 'k'];

/** Highest and lowest point and widest reach (from the square's centre) of a treasure at rest. */
function extent(type: PieceSymbol) {
  let top = -Infinity;
  let bottom = Infinity;
  let reach = 0;
  const v = new Vector3();
  for (const { geometry, matrix } of restPose(type)) {
    const pos = geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      top = Math.max(top, v.y);
      bottom = Math.min(bottom, v.y);
      reach = Math.max(reach, Math.hypot(v.x, v.z));
    }
  }
  return { top, bottom, reach };
}

/** Triangles a treasure draws at rest, base included. */
function triangles(type: PieceSymbol): number {
  let n = 0;
  for (const { geometry } of restPose(type)) {
    n += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  }
  return n;
}

afterEach(() => disposeOwned());

describe('TREASURE_HEIGHT', () => {
  it('is the ladder the spec sets', () => {
    expect(TREASURE_HEIGHT).toEqual({ p: 0.55, n: 0.75, b: 0.9, r: 1.0, q: 1.2, k: 1.4 });
  });

  it('climbs pearl < bell < mirror < cauldron < swords < seal', () => {
    for (let i = 1; i < LADDER.length; i++) {
      expect(TREASURE_HEIGHT[LADDER[i]]).toBeGreaterThan(TREASURE_HEIGHT[LADDER[i - 1]]);
    }
  });
});

describe.each(LADDER)('the %s treasure at rest', (type) => {
  it('tops out at its TREASURE_HEIGHT', () => {
    expect(extent(type).top).toBeCloseTo(TREASURE_HEIGHT[type], 2);
  });

  it(`fits inside radius ${TREASURE_RADIUS} of its square`, () => {
    expect(extent(type).reach).toBeLessThanOrEqual(TREASURE_RADIUS);
  });

  it('stands on the board, not in it', () => {
    expect(extent(type).bottom).toBeGreaterThanOrEqual(-1e-6);
    expect(extent(type).bottom).toBeLessThan(0.01);
  });

  it('floats its body clear of the base', () => {
    const base = new Set(Object.values(baseKit()));
    let lowest = Infinity;
    const v = new Vector3();
    for (const { geometry, matrix } of restPose(type)) {
      if (base.has(geometry)) continue;
      const pos = geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        lowest = Math.min(lowest, v.fromBufferAttribute(pos, i).applyMatrix4(matrix).y);
      }
    }
    // The bell's clapper hangs a little below its mouth; everything clears the base's top.
    expect(lowest).toBeGreaterThan(BASE_TOP + 0.05);
  });

  it('keeps to its triangle budget', () => {
    // Sixteen pawns share the board, so theirs is the tightest.
    expect(triangles(type)).toBeLessThanOrEqual(type === 'p' ? 5500 : 9000);
  });
});

describe('the kits', () => {
  it('are built once and shared until the battle is disposed', () => {
    const first = sealKit();
    expect(sealKit()).toBe(first);
    disposeOwned();
    const second = sealKit();
    expect(second).not.toBe(first);
    expect(second.jade).not.toBe(first.jade);
  });

  it('hand every geometry to the battle for disposal', () => {
    const k = pearlKit();
    const freed: string[] = [];
    for (const [name, g] of Object.entries(k))
      g.addEventListener('dispose', () => freed.push(name));
    disposeOwned();
    expect(freed.sort()).toEqual(Object.keys(k).sort());
  });

  it('lay the glyph on the base top, on its owner half, inside the plinth', () => {
    const glyph = baseKit().glyph;
    glyph.computeBoundingBox();
    const box = glyph.boundingBox!;
    expect(box.min.y).toBeGreaterThan(BASE_TOP);
    expect(box.max.y).toBeLessThan(BASE_TOP + 0.005);
    // Owner side (+z), and inside the plinth's top (radius 0.33).
    expect(box.min.z).toBeGreaterThan(0);
    expect(box.max.z).toBeLessThan(0.33);
    expect(box.max.z - box.min.z).toBeCloseTo(2 * GLYPH.radius, 3);
  });
});
