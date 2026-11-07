import { describe, expect, it } from 'vitest';
import { leatherNormal, quiltNormal, weaveNormal } from './grain';

/** Opaque, deterministic, and mostly upward: what every runtime normal map must be. */
function expectNormalMap(make: () => Uint8Array, size: number): Uint8Array {
  const map = make();
  expect(map).toHaveLength(size * size * 4);
  expect(make()).toEqual(map);
  let blue = 0;
  let red = 0;
  for (let i = 0; i < map.length; i += 4) {
    expect(map[i + 3]).toBe(255);
    blue += map[i + 2];
    red += map[i];
  }
  expect(blue / (size * size)).toBeGreaterThan(200);
  // Slopes left and right balance over a tile: the map is level on the whole.
  expect(Math.abs(red / (size * size) - 127.5)).toBeLessThan(3);
  return map;
}

describe('leatherNormal', () => {
  it('is an opaque, deterministic, mostly upward normal map', () => {
    expectNormalMap(() => leatherNormal(64, 8, 3), 64);
  });
});

describe('quiltNormal', () => {
  it('is an opaque, deterministic, mostly upward normal map', () => {
    expectNormalMap(() => quiltNormal(64, 2), 64);
  });

  it('tiles: the row past the last is the first again', () => {
    const size = 64;
    const map = quiltNormal(size, 2);
    // The pattern has the tile's period, so the first and the last rows slope towards each other
    // (green: the slope along y, across the tile's edge).
    const green = (x: number, y: number) => map[(y * size + x) * 4 + 1];
    expect(Math.abs(green(10, 0) + green(10, size - 1) - 255)).toBeLessThan(6);
  });
});

describe('weaveNormal', () => {
  it('is an opaque, deterministic, mostly upward normal map', () => {
    expectNormalMap(() => weaveNormal(64, 8), 64);
  });

  it('alternates which thread is on top from one cell to the next', () => {
    const size = 64;
    const map = weaveNormal(size, 8);
    // Green (the slope along y) at the middle of a warp-over cell and of the weft-over cell next
    // to it along x: a weft thread on top slopes along y, a warp thread does not.
    const green = (x: number, y: number) => map[(y * size + x) * 4 + 1];
    const slope = (cx: number) => Math.abs(green(cx, 2) - green(cx, 5));
    expect(Math.abs(slope(4) - slope(12))).toBeGreaterThan(8);
  });
});
