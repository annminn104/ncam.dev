import { describe, expect, it } from 'vitest';
import { VU_COLOURS, VU_SEGMENTS, vuLevels } from './vu';

const lit = (levels: number[]) => levels.filter((level) => level >= 1).length;

describe('vuLevels', () => {
  it('is ten segments, all off when nothing is loaded', () => {
    expect(VU_SEGMENTS).toBe(10);
    expect(VU_COLOURS).toHaveLength(10);
    expect(vuLevels(1234, false, false)).toEqual(new Array(10).fill(0));
    expect(vuLevels(1234, false, true)).toEqual(new Array(10).fill(0));
  });

  it('lights a prefix of the strip between 0 and 1, the same for the same time', () => {
    for (let t = 0; t < 4000; t += 70) {
      const levels = vuLevels(t, true, false);
      expect(levels).toHaveLength(10);
      expect(levels).toEqual(vuLevels(t, true, false));
      for (let i = 0; i < 10; i++) {
        expect(levels[i]).toBeGreaterThanOrEqual(0);
        expect(levels[i]).toBeLessThanOrEqual(1);
        // Every segment under a fully lit one is fully lit.
        if (levels[i] >= 1) for (let j = 0; j < i; j++) expect(levels[j]).toBe(1);
      }
    }
  });

  it('moves while a track plays, and holds its peak', () => {
    const counts = new Set<number>();
    for (let t = 0; t < 3000; t += 100) counts.add(lit(vuLevels(t, true, false)));
    expect(counts.size).toBeGreaterThan(2);
    // Peak hold: a segment above the lit prefix glows at half.
    let held = 0;
    for (let t = 0; t < 3000; t += 100) {
      const levels = vuLevels(t, true, false);
      if (levels.some((level) => level > 0.5 && level < 1)) held += 1;
    }
    expect(held).toBeGreaterThan(0);
  });

  it('is calm under reduced motion: half the strip at most, and slow', () => {
    for (let t = 0; t < 6000; t += 40) {
      const now = vuLevels(t, true, true);
      const next = vuLevels(t + 16, true, true);
      for (let i = 5; i < 10; i++) expect(now[i]).toBe(0);
      const sum = (levels: number[]) => levels.reduce((a, b) => a + b, 0);
      expect(Math.abs(sum(next) - sum(now))).toBeLessThan(0.25);
    }
  });

  it('fills the array it is given', () => {
    const out = new Array<number>(10).fill(-1);
    expect(vuLevels(500, true, false, out)).toBe(out);
    expect(out.every((level) => level >= 0)).toBe(true);
  });
});
