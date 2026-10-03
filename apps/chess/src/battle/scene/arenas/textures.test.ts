import { afterEach, describe, expect, it } from 'vitest';
import { disposeOwned } from '../dispose';
import {
  crackPixels,
  crackTexture,
  lotusPixels,
  puffPixels,
  puffTexture,
  seeded,
} from './textures';

afterEach(() => disposeOwned());

/** Channel `c` of pixel (i, j) in a square RGBA image; row 0 is the bottom. */
const at = (px: Uint8Array, size: number, i: number, j: number, c: number) =>
  px[(j * size + i) * 4 + c];

describe('seeded', () => {
  it('repeats its sequence for a seed, and stays in [0, 1)', () => {
    const a = seeded(7);
    const b = seeded(7);
    const xs = Array.from({ length: 500 }, () => a());
    expect(Array.from({ length: 500 }, () => b())).toEqual(xs);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(seeded(8)()).not.toBe(xs[0]);
  });
});

describe('puffPixels', () => {
  const S = 64;
  const px = puffPixels(S);

  it('is a soft blob: solid in the middle, clear at the edges and corners', () => {
    expect(at(px, S, S / 2, S / 2, 3)).toBeGreaterThan(200);
    for (const [i, j] of [
      [0, 0],
      [S - 1, 0],
      [0, S - 1],
      [S - 1, S - 1],
      [S / 2, 0],
      [S / 2, S - 1],
    ]) {
      expect(at(px, S, i, j, 3)).toBe(0);
    }
  });

  it('is sunlit on top and cool grey-blue underneath', () => {
    const lower = at(px, S, S / 2, Math.round(S * 0.3), 0);
    const upper = at(px, S, S / 2, Math.round(S * 0.7), 0);
    expect(upper).toBeGreaterThan(lower);
    // Underneath, blue leads red.
    expect(at(px, S, S / 2, Math.round(S * 0.3), 2)).toBeGreaterThan(lower);
  });
});

describe('crackPixels', () => {
  const S = 128;
  const px = crackPixels(S, 7);
  /** Mean absolute difference between column a and column b. */
  const columns = (a: number, b: number) => {
    let sum = 0;
    for (let j = 0; j < S; j++) sum += Math.abs(at(px, S, a, j, 0) - at(px, S, b, j, 0));
    return sum / S;
  };
  const rows = (a: number, b: number) => {
    let sum = 0;
    for (let i = 0; i < S; i++) sum += Math.abs(at(px, S, i, a, 0) - at(px, S, i, b, 0));
    return sum / S;
  };

  it('tiles: across the wrap it changes no more than between neighbours inside', () => {
    let inside = 0;
    for (let i = 0; i < S - 1; i++) inside = Math.max(inside, columns(i, i + 1), rows(i, i + 1));
    expect(columns(S - 1, 0)).toBeLessThanOrEqual(inside);
    expect(rows(S - 1, 0)).toBeLessThanOrEqual(inside);
  });

  it('has glowing seams over dark crust', () => {
    const values = Array.from({ length: S * S }, (_, n) => px[n * 4]);
    const bright = values.filter((v) => v > 180).length / values.length;
    const dark = values.filter((v) => v < 60).length / values.length;
    expect(bright).toBeGreaterThan(0.02);
    expect(bright).toBeLessThan(0.25);
    expect(dark).toBeGreaterThan(0.4);
  });
});

describe('lotusPixels', () => {
  const S = 64;
  const px = lotusPixels(S);

  it('is mirror-symmetric, left to right and top to bottom', () => {
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const a = at(px, S, i, j, 3);
        expect(Math.abs(a - at(px, S, S - 1 - i, j, 3))).toBeLessThanOrEqual(1);
        expect(Math.abs(a - at(px, S, i, S - 1 - j, 3))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('has a solid seed pod, petals round it, and clear corners', () => {
    expect(at(px, S, S / 2, S / 2, 3)).toBe(255);
    expect(at(px, S, 0, 0, 3)).toBe(0);
    let petals = 0;
    for (let n = 0; n < S * S; n++) if (px[n * 4 + 3] > 128) petals++;
    expect(petals / (S * S)).toBeGreaterThan(0.25);
    expect(petals / (S * S)).toBeLessThan(0.75);
  });
});

describe('arena textures', () => {
  it('are built once per battle and freed by disposeOwned', () => {
    const puff = puffTexture();
    expect(puffTexture()).toBe(puff);
    let freed = false;
    puff.addEventListener('dispose', () => (freed = true));
    const crack = crackTexture();
    disposeOwned();
    expect(freed).toBe(true);
    expect(puffTexture()).not.toBe(puff);
    expect(crackTexture()).not.toBe(crack);
  });
});
