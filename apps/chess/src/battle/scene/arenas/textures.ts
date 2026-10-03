import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { onDispose, own } from '../dispose';

// The arenas' textures, painted in code: nothing is fetched (drei's clouds would pull a PNG from
// a CDN). The pixel functions are pure, so Node tests can look at them; the textures built from
// them are cached for the battle, `own()`ed and dropped by `disposeOwned()`.

/** A small seeded PRNG (mulberry32): an arena is laid out the same way every time. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Lattice value noise, periodic in both axes over `period` cells. Returns 0..1. */
function valueNoise(x: number, y: number, period: number, seed: number): number {
  const hash = (i: number, j: number) => {
    const ii = ((i % period) + period) % period;
    const jj = ((j % period) + period) % period;
    let h = Math.imul(ii * 374761393 + jj * 668265263 + seed * 2246822519, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * A cumulus puff, RGBA. Row 0 is the bottom of the quad (DataTextures are not flipped): a
 * rounded, lumpy top over a flatter base, white where the sun reaches it and a cool grey-blue
 * underneath, its edge frayed by noise.
 */
export function puffPixels(size: number): Uint8Array {
  const lumps = [
    { x: 0, y: -0.18, r: 0.6 },
    { x: -0.4, y: -0.12, r: 0.42 },
    { x: 0.38, y: -0.14, r: 0.44 },
    { x: -0.14, y: 0.2, r: 0.42 },
    { x: 0.2, y: 0.16, r: 0.38 },
  ];
  const out = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    const v = ((j + 0.5) / size) * 2 - 1;
    for (let i = 0; i < size; i++) {
      const u = ((i + 0.5) / size) * 2 - 1;
      let field = -1;
      for (const l of lumps) field = Math.max(field, 1 - Math.hypot(u - l.x, v - l.y) / l.r);
      field += (valueNoise(u * 5 + 7, v * 5 + 3, 1024, 11) - 0.5) * 0.3;
      const alpha = smoothstep(0, 0.42, field) * smoothstep(-0.8, -0.42, v);
      const lit = smoothstep(-0.62, 0.5, v) * 0.85 + Math.max(0, field) * 0.15;
      const k = (j * size + i) * 4;
      out[k] = Math.round(255 * (0.84 + 0.16 * lit));
      out[k + 1] = Math.round(255 * (0.88 + 0.12 * lit));
      out[k + 2] = Math.round(255 * (0.94 + 0.06 * lit));
      out[k + 3] = Math.round(255 * alpha);
    }
  }
  return out;
}

/**
 * Molten cracks, greyscale RGBA that tiles in both directions: the edges of a wrapped Voronoi
 * diagram glow, brighter along some seams than others. The lava sea and the rock pillar use it as
 * their emissive map.
 */
export function crackPixels(size: number, seed: number, cells = 5): Uint8Array {
  const rand = seeded(seed);
  const points: number[] = [];
  for (let n = 0; n < cells * cells; n++) points.push(rand(), rand());
  const out = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    const py = ((j + 0.5) / size) * cells;
    const cj = Math.floor(py);
    for (let i = 0; i < size; i++) {
      const px = ((i + 0.5) / size) * cells;
      const ci = Math.floor(px);
      let d1 = Infinity;
      let d2 = Infinity;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ni = ci + di;
          const nj = cj + dj;
          const wi = ((ni % cells) + cells) % cells;
          const wj = ((nj % cells) + cells) % cells;
          const p = (wj * cells + wi) * 2;
          const d = Math.hypot(ni + points[p] - px, nj + points[p + 1] - py);
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) d2 = d;
        }
      }
      const edge = d2 - d1;
      const heat = 0.45 + 0.55 * valueNoise((px / cells) * 4, (py / cells) * 4, 4, seed);
      const glow = Math.exp(-edge * 13) * heat + Math.exp(-edge * 3) * 0.1;
      const g = Math.round(255 * Math.min(1, glow));
      const k = (j * size + i) * 4;
      out[k] = g;
      out[k + 1] = g;
      out[k + 2] = g;
      out[k + 3] = 255;
    }
  }
  return out;
}

/**
 * A lotus rosette seen from above, white on transparent: eight outer petals, eight inner ones
 * between them (set off by a thin gap) and a seed pod. The Lotus Moon Lake's inlays.
 */
export function lotusPixels(size: number): Uint8Array {
  const aa = 1.5 / (size / 2);
  /** Signed distance (radius units, negative inside) to a petal along angle `phi`. */
  const petal = (r: number, theta: number, phi: number, from: number, to: number, w: number) => {
    const a = r * Math.cos(theta - phi);
    const b = Math.abs(r * Math.sin(theta - phi));
    if (a <= from || a >= to) return Math.min(Math.abs(a - from), Math.abs(a - to)) + b;
    const t = (a - from) / (to - from);
    return b - w * Math.pow(Math.sin(Math.PI * t), 0.75) * (1 - 0.25 * t);
  };
  const out = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    const y = ((j + 0.5) / size) * 2 - 1;
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size) * 2 - 1;
      const r = Math.hypot(x, y);
      const theta = Math.atan2(y, x);
      let outer = Infinity;
      let inner = Infinity;
      for (let k = 0; k < 8; k++) {
        outer = Math.min(outer, petal(r, theta, (k * Math.PI) / 4 + Math.PI / 8, 0.12, 0.96, 0.27));
        inner = Math.min(inner, petal(r, theta, (k * Math.PI) / 4, 0.1, 0.66, 0.2));
      }
      const pod = r - 0.17;
      // Each layer cuts a thin gap round the one above it, so the petals read one by one.
      let alpha = smoothstep(aa, -aa, outer) * smoothstep(-aa, aa, inner - 0.05);
      alpha = Math.max(alpha, smoothstep(aa, -aa, inner)) * smoothstep(-aa, aa, pod - 0.05);
      alpha = Math.max(alpha, smoothstep(aa, -aa, pod));
      const k = (j * size + i) * 4;
      out[k] = 255;
      out[k + 1] = 255;
      out[k + 2] = 255;
      out[k + 3] = Math.round(255 * alpha);
    }
  }
  return out;
}

function texture(data: Uint8Array, size: number, color: boolean, repeat: boolean): DataTexture {
  const tex = own(new DataTexture(data, size, size, RGBAFormat, UnsignedByteType));
  tex.colorSpace = color ? SRGBColorSpace : NoColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  if (repeat) tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

let puff: DataTexture | null = null;
let crack: DataTexture | null = null;
let lotus: DataTexture | null = null;
onDispose(() => {
  puff = null;
  crack = null;
  lotus = null;
});

export const puffTexture = () => (puff ??= texture(puffPixels(128), 128, true, false));
export const crackTexture = () => (crack ??= texture(crackPixels(256, 7), 256, false, true));
export const lotusTexture = () => (lotus ??= texture(lotusPixels(128), 128, false, false));
