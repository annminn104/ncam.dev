import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  type ColorRepresentation,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from './textures';

// The arenas' scenery as plain geometry, built once per battle and merged by material so each
// arena adds a handful of draw calls. React-free, so Node tests can check where things stand.

/** A rock column: a summit, a pillar, a spire. Heights are world y, the radius is its widest. */
export interface Column {
  x: number;
  z: number;
  base: number;
  top: number;
  radius: number;
  seed: number;
}

export interface ColumnStyle {
  sides: number;
  rings: number;
  /** Radius at height fraction t (0 base, 1 top), as a fraction of the column's radius. */
  profile(t: number): number;
  /** Random radial jitter, a fraction of the local radius. */
  jag: number;
  /** How far the top drifts sideways, a fraction of the height. */
  lean: number;
  cap: 'flat' | 'dome' | 'point';
  colors: { base: ColorRepresentation; top: ColorRepresentation; cap: ColorRepresentation };
  /** Exponent of the base-to-top colour ramp: above 1 keeps the top colour to the crown. */
  ramp?: number;
  /**
   * Glow of the emissive veins at the base and the top, linear in between (adds a `heat`
   * attribute). Values past 0..1 are fine: the material clamps, so the glow can stop part-way.
   */
  heat?: { base: number; top: number };
  /** World units per texture repeat (the `uv` attribute). */
  tile?: number;
}

/**
 * One rock column. Every column carries position, normal, color and uv (plus `heat` when the
 * style asks for it), so columns of one style merge into one geometry.
 */
export function columnGeometry(c: Column, style: ColumnStyle): BufferGeometry {
  const rand = seeded(c.seed);
  const { sides, rings } = style;
  const tile = style.tile ?? 6;
  const height = c.top - c.base;
  const leanDir = rand() * Math.PI * 2;
  const lean = style.lean * height * (0.5 + 0.5 * rand());
  const twist = rand() * Math.PI * 2;
  const jitter = Array.from({ length: (rings + 1) * sides }, () => (rand() * 2 - 1) * style.jag);
  const base = new Color(style.colors.base);
  const top = new Color(style.colors.top);
  const capColor = new Color(style.colors.cap);
  const tint = new Color();

  const position: number[] = [];
  const color: number[] = [];
  const uv: number[] = [];
  const heat: number[] = [];
  const index: number[] = [];
  const centre = (t: number): [number, number] => [
    c.x + Math.cos(leanDir) * lean * t * t,
    c.z + Math.sin(leanDir) * lean * t * t,
  ];
  const push = (x: number, y: number, z: number, col: Color, u: number, t: number) => {
    position.push(x, y, z);
    color.push(col.r, col.g, col.b);
    uv.push(u, y / tile);
    if (style.heat) heat.push(style.heat.base + (style.heat.top - style.heat.base) * t);
  };

  // The walls: rings of `sides` vertices, the first repeated at the end to close the uv seam.
  const around = (2 * Math.PI * c.radius) / tile;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const [ox, oz] = centre(t);
    const r = c.radius * style.profile(t);
    tint.copy(base).lerp(top, Math.pow(t, style.ramp ?? 1));
    for (let k = 0; k <= sides; k++) {
      const a = twist + ((k % sides) / sides) * Math.PI * 2;
      const jr = r * (1 + jitter[i * sides + (k % sides)]);
      push(
        ox + Math.cos(a) * jr,
        c.base + t * height,
        oz + Math.sin(a) * jr,
        tint,
        (k / sides) * around,
        t,
      );
    }
  }
  const row = sides + 1;
  for (let i = 0; i < rings; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * row + k;
      const b = a + row;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  // The cap: a fan to the centre (flat), a low dome, or a point.
  const [cx, cz] = centre(1);
  const ringStart = rings * row;
  let rim = ringStart;
  if (style.cap === 'dome') {
    // One more, narrower ring, slightly raised, then the crown.
    const r = c.radius * style.profile(1) * 0.62;
    const y = c.top + c.radius * 0.28;
    rim = position.length / 3;
    for (let k = 0; k <= sides; k++) {
      const a = twist + ((k % sides) / sides) * Math.PI * 2 + Math.PI / sides;
      push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, capColor, (k / sides) * around, 1);
    }
    for (let k = 0; k < sides; k++) {
      const a = ringStart + k;
      const b = rim + k;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const apexY = c.top + c.radius * CAP_RISE[style.cap];
  const apex = position.length / 3;
  push(cx, apexY, cz, style.cap === 'point' ? top : capColor, around / 2, 1);
  for (let k = 0; k < sides; k++) index.push(rim + k, apex, rim + k + 1);

  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(position, 3));
  g.setAttribute('color', new Float32BufferAttribute(color, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  if (style.heat) g.setAttribute('heat', new Float32BufferAttribute(heat, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** How high a column's cap reaches above its `top`, as a fraction of its radius. */
const CAP_RISE = { flat: 0, dome: 0.36, point: 0.9 } as const;

/**
 * A cylinder that holds the whole column, lean, jitter and cap included: the tests check
 * these against every camera the player can reach.
 */
export function columnBounds(c: Column, style: ColumnStyle) {
  // The walls only have vertices at the rings, and the dome's ring is narrower than the top's.
  let widest = 0;
  for (let i = 0; i <= style.rings; i++) widest = Math.max(widest, style.profile(i / style.rings));
  return {
    x: c.x,
    z: c.z,
    radius: c.radius * widest * (1 + style.jag) + style.lean * (c.top - c.base),
    top: c.top + c.radius * CAP_RISE[style.cap],
  };
}

export function columnsGeometry(columns: Column[], style: ColumnStyle): BufferGeometry {
  const parts = columns.map((c) => columnGeometry(c, style));
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** Gives a primitive one flat vertex colour, so tiers of different stone merge into one draw. */
function painted(g: BufferGeometry, col: ColorRepresentation): BufferGeometry {
  const c = new Color(col);
  const n = g.getAttribute('position').count;
  const color = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) color.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new Float32BufferAttribute(color, 3));
  return g;
}

/**
 * Stepped square dais under the board (Jade Cloud Peak): `tiers` from the top down, each
 * `[halfWidth, height, colour]`, the first one's top at `top`.
 */
export function daisGeometry(
  top: number,
  tiers: [half: number, height: number, color: ColorRepresentation][],
): BufferGeometry {
  let y = top;
  const parts = tiers.map(([half, h, col]) => {
    const g = painted(new BoxGeometry(half * 2, h, half * 2), col);
    g.translate(0, y - h / 2, 0);
    y -= h;
    return g;
  });
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** Stepped round platform (Lotus Moon Lake), as `daisGeometry` but with discs. */
export function platformGeometry(
  top: number,
  tiers: [radius: number, height: number, color: ColorRepresentation][],
  segments: number,
): BufferGeometry {
  let y = top;
  const parts = tiers.map(([r, h, col]) => {
    const g = painted(new CylinderGeometry(r, r * 1.015, h, segments, 1), col);
    g.translate(0, y - h / 2, 0);
    y -= h;
    return g;
  });
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/**
 * A closed ring of hills or cliffs on the horizon: a band round the board at `radius`, from
 * `base` up to `height(angle)`, coloured `low` at the foot to `high` at the crest.
 */
export function ridgeGeometry(opts: {
  radius: number;
  base: number;
  segments: number;
  height(angle: number): number;
  low: ColorRepresentation;
  high: ColorRepresentation;
}): BufferGeometry {
  const { radius, base, segments } = opts;
  const low = new Color(opts.low);
  const high = new Color(opts.high);
  const position: number[] = [];
  const color: number[] = [];
  const index: number[] = [];
  for (let k = 0; k <= segments; k++) {
    const a = (k / segments) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    position.push(x, base, z, x, opts.height(a), z);
    color.push(low.r, low.g, low.b, high.r, high.g, high.b);
    if (k < segments) {
      const i = k * 2;
      // Wound to face the board (inward), the only side anyone sees.
      index.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(position, 3));
  g.setAttribute('color', new Float32BufferAttribute(color, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * Molten seams (Blood Moon Abyss): a glowing strip along every square boundary of the board,
 * the grid lines x, z = -4..4. Each strip is bright along its centre line and black at its
 * edges, so additive blending makes a soft glow; its brightness wanders along its length.
 */
export function seamGeometry(halfWidth: number, y: number, seed: number): BufferGeometry {
  const rand = seeded(seed);
  const position: number[] = [];
  const color: number[] = [];
  const index: number[] = [];
  const STEPS = 16;
  for (let axis = 0; axis < 2; axis++) {
    // Across the strip from one edge to the other, in the order that winds it facing up.
    const across = axis === 0 ? [-halfWidth, 0, halfWidth] : [halfWidth, 0, -halfWidth];
    for (let line = -4; line <= 4; line++) {
      const start = position.length / 3;
      for (let s = 0; s <= STEPS; s++) {
        const along = -4 + (8 * s) / STEPS;
        const glow = 0.55 + 0.45 * rand();
        for (const offset of across) {
          const k = offset === 0 ? glow : 0;
          const [x, z] = axis === 0 ? [line + offset, along] : [along, line + offset];
          position.push(x, y, z);
          color.push(k, k, k);
        }
        if (s < STEPS) {
          const a = start + s * 3;
          index.push(
            a,
            a + 3,
            a + 1,
            a + 1,
            a + 3,
            a + 4,
            a + 1,
            a + 4,
            a + 2,
            a + 2,
            a + 4,
            a + 5,
          );
        }
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(position, 3));
  g.setAttribute('color', new Float32BufferAttribute(color, 3));
  g.setIndex(index);
  return g;
}

/** A flat, upward-facing square on the xz plane, uv 0..1. */
function decal(x: number, y: number, z: number, size: number): BufferGeometry {
  const h = size / 2;
  const corners: [number, number, number, number][] = [
    [-h, -h, 0, 0],
    [h, -h, 1, 0],
    [h, h, 1, 1],
    [-h, h, 0, 1],
  ];
  const position: number[] = [];
  const uv: number[] = [];
  for (const [u, v, tu, tv] of corners) {
    position.push(x + u, y, z + v);
    uv.push(tu, tv);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  return g;
}

/** Where the Lotus Moon Lake's inlays sit: [x, y, z, size]. */
export function inlayPlacements(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  // A chain of small lotuses round the board's frame (its top is at y -0.01, between 4 and 4.4).
  for (const side of [-1, 1]) {
    for (let k = 0; k < 16; k++) {
      const along = -3.75 + k * 0.5;
      out.push([along, -0.006, side * 4.2, 0.3], [side * 4.2, -0.006, along, 0.3]);
    }
    out.push([side * 4.2, -0.006, 4.2, 0.34], [side * 4.2, -0.006, -4.2, 0.34]);
  }
  // A large lotus at each edge of the upper terrace (its top is the board's underside, -0.31),
  // and a ring on the lower terrace, 0.4 below it (layout.test.ts holds these to the terraces).
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    out.push([Math.cos(a) * 5.65, -0.306, Math.sin(a) * 5.65, 1.5]);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6 + Math.PI / 12;
    out.push([Math.cos(a) * 7.38, -0.706, Math.sin(a) * 7.38, 0.66]);
  }
  return out;
}

export function inlayGeometry(): BufferGeometry {
  const parts = inlayPlacements().map(([x, y, z, size]) => decal(x, y, z, size));
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** One puff of the cloud sea: its centre, its size, and its tint (linear rgb). */
export interface Puff {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  tint: [number, number, number];
}

/**
 * Jade Cloud Peak's cloud sea: a collar of puffs round the summit's neck, then a sea thinning
 * out towards the horizon. Every puff's top stays below `ceiling`, under the dais, so no cloud
 * can drift over the board. Puffs facing the sun (`sunAzimuth`, radians) are warmer.
 */
export function cloudPuffs(count: number, seed: number, sunAzimuth: number, ceiling: number) {
  const rand = seeded(seed);
  const warm = new Color('#fff3e2');
  const cool = new Color('#e3ebf5');
  const tint = new Color();
  const puffs: Puff[] = [];
  for (let i = 0; i < count; i++) {
    const collar = i < count * 0.3;
    const r = collar ? 5 + rand() * 5 : 10 + Math.pow(rand(), 1.4) * 66;
    const a = rand() * Math.PI * 2;
    const y = collar ? -6.4 + rand() * 1.4 : -6.8 + rand() * 1.4 - r * 0.012;
    let width = (collar ? 4.5 : 6) + rand() * 5 + r * 0.06;
    let height = width * (0.34 + rand() * 0.16);
    const room = 2 * (ceiling - y);
    if (height > room) {
      width *= room / height;
      height = room;
    }
    tint.copy(cool).lerp(warm, 0.5 + 0.5 * Math.cos(a - sunAzimuth));
    puffs.push({
      x: Math.cos(a) * r,
      y,
      z: Math.sin(a) * r,
      width,
      height,
      tint: [tint.r, tint.g, tint.b],
    });
  }
  return puffs;
}

/**
 * The puffs a weak GPU keeps: `count` of them, spread evenly through the layout, so the collar
 * and the open sea thin out alike and every puff kept stays where it was. (A smaller layout of
 * its own would be a different sea: the collar is a share of the count.)
 */
export function thinnedPuffs(puffs: readonly Puff[], count: number): Puff[] {
  if (count >= puffs.length) return [...puffs];
  return Array.from({ length: count }, (_, k) => puffs[Math.floor((k * puffs.length) / count)]);
}

/**
 * Where drifting motes start ([x, bottom, z] each) and their [phase, pace]: seeded, scattered
 * evenly over the annulus `radius` at the bottom of their band `y`. Each mote takes the same
 * draws whatever the count, so a smaller count is the first motes of a larger one.
 */
export function motePlacements(
  look: { seed: number; radius: [min: number, max: number]; y: [bottom: number, span: number] },
  count: number,
) {
  const rand = seeded(look.seed);
  const position = new Float32Array(count * 3);
  const mote = new Float32Array(count * 2);
  const [r0, r1] = look.radius;
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    // Uniform over the annulus's area, not bunched at its inner edge.
    const r = Math.sqrt(r0 * r0 + rand() * (r1 * r1 - r0 * r0));
    position.set([Math.cos(a) * r, look.y[0], Math.sin(a) * r], i * 3);
    mote.set([rand(), 0.6 + rand() * 0.8], i * 2);
  }
  return { position, mote };
}

/** A lotus cluster on the lake: its pads and whether a flower blooms on the first one. */
export interface LotusCluster {
  x: number;
  z: number;
  pads: number;
  flower: boolean;
  seed: number;
}

/**
 * The lake's lotus: pads (notched discs, a little cupped) and flowers (two rings of cupped
 * petals round a seed pod), as two geometries with vertex colours: pads and flowers have
 * different materials (the flowers glow a little at dusk).
 */
export function lotusGeometry(
  clusters: LotusCluster[],
  water: number,
): { pads: BufferGeometry; flowers: BufferGeometry } {
  const pads = { position: [] as number[], color: [] as number[], index: [] as number[] };
  const flowers = { position: [] as number[], color: [] as number[], index: [] as number[] };
  const padEdge = new Color('#2c5b45');
  const padHeart = new Color('#4f8a5e');
  const petalBase = new Color('#fbe7ef');
  const petalTip = new Color('#e77fae');
  const podColor = new Color('#f0cf62');
  const tint = new Color();

  const addPad = (x: number, z: number, r: number, turn: number) => {
    const p = pads;
    const start = p.position.length / 3;
    p.position.push(x, water + 0.012, z);
    p.color.push(padHeart.r, padHeart.g, padHeart.b);
    const SEG = 18;
    const notch = 0.32;
    for (let k = 0; k <= SEG; k++) {
      const a = turn + notch / 2 + (k / SEG) * (Math.PI * 2 - notch);
      p.position.push(x + Math.cos(a) * r, water + 0.03, z + Math.sin(a) * r);
      p.color.push(padEdge.r, padEdge.g, padEdge.b);
      if (k < SEG) p.index.push(start, start + k + 2, start + k + 1);
    }
  };

  const addPetal = (
    x: number,
    y: number,
    z: number,
    dir: number,
    length: number,
    width: number,
    rise: number,
  ) => {
    const f = flowers;
    const start = f.position.length / 3;
    const STEPS = 4;
    const ux = Math.cos(dir);
    const uz = Math.sin(dir);
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS;
      // Out along the petal's direction, rising more steeply towards the tip: a cup.
      const out = length * t * Math.cos(rise * (0.6 + 0.6 * t));
      const up = length * t * Math.sin(rise * (0.6 + 0.6 * t));
      const w = width * Math.pow(Math.sin(Math.PI * Math.min(t, 0.96)), 0.8) * (1 - 0.3 * t);
      tint.copy(petalBase).lerp(petalTip, t * t);
      for (const side of [-1, 0, 1]) {
        f.position.push(
          x + ux * out - uz * w * side,
          y + up + Math.abs(side) * w * 0.25,
          z + uz * out + ux * w * side,
        );
        f.color.push(tint.r, tint.g, tint.b);
      }
      if (s < STEPS) {
        const a = start + s * 3;
        f.index.push(
          a,
          a + 1,
          a + 3,
          a + 1,
          a + 4,
          a + 3,
          a + 1,
          a + 2,
          a + 4,
          a + 2,
          a + 5,
          a + 4,
        );
      }
    }
  };

  const addFlower = (x: number, z: number, scale: number, turn: number) => {
    const y = water + 0.04;
    for (let k = 0; k < 8; k++) {
      addPetal(x, y, z, turn + (k / 8) * Math.PI * 2, 0.34 * scale, 0.11 * scale, 0.55);
    }
    for (let k = 0; k < 6; k++) {
      addPetal(
        x,
        y + 0.02,
        z,
        turn + ((k + 0.5) / 6) * Math.PI * 2,
        0.26 * scale,
        0.09 * scale,
        1.0,
      );
    }
    // The seed pod: a small flat-topped cone.
    const f = flowers;
    const start = f.position.length / 3;
    const SEG = 8;
    f.position.push(x, y + 0.13 * scale, z);
    f.color.push(podColor.r, podColor.g, podColor.b);
    for (let k = 0; k <= SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      f.position.push(
        x + Math.cos(a) * 0.07 * scale,
        y + 0.1 * scale,
        z + Math.sin(a) * 0.07 * scale,
      );
      f.color.push(podColor.r * 0.8, podColor.g * 0.8, podColor.b * 0.6);
      if (k < SEG) f.index.push(start, start + k + 2, start + k + 1);
    }
  };

  for (const c of clusters) {
    const rand = seeded(c.seed);
    for (let n = 0; n < c.pads; n++) {
      const a = rand() * Math.PI * 2;
      const d = n === 0 ? 0 : 0.7 + rand() * 0.6;
      const r = 0.42 + rand() * 0.4;
      const px = c.x + Math.cos(a) * d;
      const pz = c.z + Math.sin(a) * d;
      addPad(px, pz, r, rand() * Math.PI * 2);
      if (n === 0 && c.flower) addFlower(px, pz, 1 + rand() * 0.4, rand() * Math.PI);
    }
  }

  const build = (p: typeof pads) => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(p.position, 3));
    g.setAttribute('color', new Float32BufferAttribute(p.color, 3));
    g.setIndex(p.index);
    g.computeVertexNormals();
    return g;
  };
  return { pads: build(pads), flowers: build(flowers) };
}
