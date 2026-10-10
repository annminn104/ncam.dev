import { describe, expect, it } from 'vitest';
import type { PieceSymbol } from 'chess.js';
import type { BufferGeometry } from 'three';
import { BASE_TOP, TREASURE_HEIGHT, TREASURE_RADIUS } from '../../pieces/kits';
import { mergePainted, triangles } from './paint';
import { CHIBI_HAT_ROOM, HEAD_SQUASH, faceCap, frameFor, hands, rigBody } from './rig';
import type { BodyStyle, FaceStyle, HairStyle, Palette } from './types';

const TYPES: PieceSymbol[] = ['p', 'n', 'b', 'r', 'q', 'k'];

describe('chibi frames', () => {
  it('stand on the base and leave each type its hat room under its height target', () => {
    for (const t of TYPES) {
      const f = frameFor(t, t === 'n');
      expect(f.standY).toBeCloseTo(BASE_TOP, 3);
      expect(f.top + CHIBI_HAT_ROOM[t]).toBeCloseTo(TREASURE_HEIGHT[t], 1);
    }
  });
  it('keeps chibi proportions: head ≈ 40 % of the figure', () => {
    for (const t of TYPES) {
      const f = frameFor(t, false);
      const figure = f.top - f.standY;
      expect((2 * f.headR) / figure).toBeGreaterThan(0.34);
      expect((2 * f.headR) / figure).toBeLessThan(0.46);
    }
  });
  it('rises in the ladder order', () => {
    const tops = TYPES.map((t) => frameFor(t, t === 'n').top + CHIBI_HAT_ROOM[t]);
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  });
});

const PALETTE: Palette = {
  skin: '#ffe6d6',
  hair: '#f2f4f8',
  eyes: '#5a8fd6',
  main: '#f4f6fb',
  second: '#dfe6f0',
  trim: '#d6b25e',
  accent: '#7fb8e6',
  ink: '#2a2d3a',
  glow: '#fff2c2',
};
const HAIRS: HairStyle[] = ['spiky', 'ponytail', 'bob', 'none'];
const BODIES: BodyStyle[] = ['coat', 'robe', 'gown', 'armor', 'dress', 'tailcoat'];
const FACES: FaceStyle[] = ['anime', 'skull', 'visor'];
const BUDGET = [
  ['high', 1800],
  ['low', 1100],
] as const;

interface Pose {
  type: PieceSymbol;
  hair: HairStyle;
  body: BodyStyle;
  face: FaceStyle;
  mounted: boolean;
}

/** Every type in every hair and body style (and face), the knight on foot and mounted. */
const POSES: Pose[] = TYPES.flatMap((type) =>
  HAIRS.flatMap((hair, h) =>
    BODIES.flatMap((body, b) =>
      (type === 'n' ? [false, true] : [false]).map((mounted) => ({
        type,
        hair,
        body,
        face: FACES[(h + b) % FACES.length],
        mounted,
      })),
    ),
  ),
);

const label = (p: Pose, q: string) =>
  `${p.type} ${p.hair} ${p.body} ${p.face}${p.mounted ? ' mounted' : ''} ${q}`;

function rig(p: Pose, quality: 'high' | 'low') {
  const frame = frameFor(p.type, p.mounted);
  const out = rigBody(
    { type: p.type, side: 'w', palette: PALETTE, frame, quality },
    { hair: p.hair, face: p.face, body: p.body, parts: [], mounted: p.mounted },
  );
  return { frame, parts: out.body ?? [], accents: out.accents ?? [] };
}

function extents(parts: BufferGeometry[]) {
  let minY = Infinity;
  let maxY = -Infinity;
  let maxR = 0;
  for (const g of parts) {
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      minY = Math.min(minY, pos.getY(i));
      maxY = Math.max(maxY, pos.getY(i));
      maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getZ(i)));
    }
  }
  return { minY, maxY, maxR };
}

describe('chibi rig body', () => {
  it('keeps the rig under its triangle budget at both qualities', () => {
    for (const p of POSES) {
      for (const [quality, limit] of BUDGET) {
        const n = rig(p, quality).parts.reduce((sum, g) => sum + triangles(g), 0);
        expect(n, label(p, quality)).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('paints every part, so the whole figure merges into one draw', () => {
    for (const p of POSES) {
      const { parts, accents } = rig(p, 'high');
      expect(accents, label(p, 'high')).toEqual([]);
      for (const g of parts) {
        expect(g.getAttribute('color')?.count, label(p, 'high')).toBe(
          g.getAttribute('position').count,
        );
        expect(g.getAttribute('normal')?.count, label(p, 'high')).toBe(
          g.getAttribute('position').count,
        );
      }
      const merged = mergePainted(parts);
      expect(triangles(merged)).toBe(parts.reduce((sum, g) => sum + triangles(g), 0));
    }
  });

  it('stands on its base, under its frame top and inside its square', () => {
    for (const p of POSES) {
      for (const [quality] of BUDGET) {
        const { frame, parts } = rig(p, quality);
        const e = extents(parts);
        expect(e.minY, label(p, quality)).toBeGreaterThan(frame.standY - 0.002);
        // On foot the boots (or the gown's hem) touch the base; a rider sits up on its mount.
        if (p.mounted) expect(e.minY, label(p, quality)).toBeGreaterThan(frame.standY + 0.1);
        else expect(e.minY, label(p, quality)).toBeLessThan(frame.standY + 0.006);
        // Headwear sits on `top`: the hair may not poke up through it.
        expect(e.maxY, label(p, quality)).toBeLessThan(frame.top + 0.004);
        expect(e.maxY, label(p, quality)).toBeGreaterThan(frame.top - frame.headR * 0.1);
        expect(e.maxR, label(p, quality)).toBeLessThan(TREASURE_RADIUS);
      }
    }
  });
});

describe('chibi hands', () => {
  it('end the arms where held things go: the right hand on -x, both in front of the hips', () => {
    for (const t of TYPES) {
      for (const mounted of [false, true]) {
        const f = frameFor(t, mounted);
        const { left, right } = hands(f, mounted);
        expect(right[0]).toBeLessThan(0);
        expect(left[0]).toBeCloseTo(-right[0], 6);
        expect(left[1]).toBeCloseTo(right[1], 6);
        expect(right[1]).toBeLessThan(f.shoulderY);
        expect(right[1]).toBeGreaterThan(f.standY);
        expect(right[2]).toBeGreaterThanOrEqual(0);
        expect(Math.hypot(right[0], right[2])).toBeLessThan(TREASURE_RADIUS);
      }
    }
  });
});

describe('chibi face cap', () => {
  it('wraps the front of the head just outside its skin, upright and unmirrored', () => {
    for (const t of TYPES) {
      const f = frameFor(t, false);
      const g = faceCap(f);
      const pos = g.getAttribute('position');
      const uv = g.getAttribute('uv');
      let minX = 0;
      let maxX = 0;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i) - f.headY;
        const z = pos.getZ(i);
        expect(z).toBeGreaterThan(0);
        // On the head's (squashed) surface, a hair's breadth out.
        const r = Math.hypot(x / HEAD_SQUASH[0], y / HEAD_SQUASH[1], z / HEAD_SQUASH[2]);
        expect(r / f.headR).toBeGreaterThan(1.002);
        expect(r / f.headR).toBeLessThan(1.03);
        // The canvas's left is the owner's left, its top is up.
        const u = uv.getX(i) - 0.5;
        const v = uv.getY(i) - 0.5;
        if (Math.abs(u) > 0.01) expect(Math.sign(x)).toBe(Math.sign(u));
        if (Math.abs(v) > 0.01) expect(Math.sign(y)).toBe(Math.sign(v));
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
      // Wide enough for both eyes and the blush (≈ 110° of the head).
      expect(maxX / f.headR).toBeGreaterThan(0.8);
      expect(minX / f.headR).toBeLessThan(-0.8);
    }
  });
});
