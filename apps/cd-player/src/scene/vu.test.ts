import { describe, expect, it } from 'vitest';
import { VU_COLOURS, VU_SEGMENTS, vuFrame, vuLevels } from './vu';

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

  it('moves while a track plays', () => {
    const counts = new Set<number>();
    for (let t = 0; t < 3000; t += 100) counts.add(lit(vuLevels(t, true, false)));
    expect(counts.size).toBeGreaterThan(2);
  });

  it('holds the top segment it reached at half once the level has fallen', () => {
    // When the strip reaches highest in three seconds of play.
    let best = 0;
    let at = 0;
    for (let t = 0; t < 3000; t += 10) {
      const count = lit(vuLevels(t, true, false));
      if (count > best) {
        best = count;
        at = t;
      }
    }
    const top = Math.min(VU_SEGMENTS - 1, best);
    const later = vuLevels(at + 200, true, false);
    // 200 ms on, the live level is below that segment, and the hold still lights it at half.
    expect(lit(later)).toBeLessThan(top);
    expect(later[top]).toBeGreaterThanOrEqual(0.55);
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

describe('vuFrame', () => {
  const off = new Array(10).fill(0);

  it('keeps the strip dark on a paused track until a track has played', () => {
    const out = new Array<number>(10).fill(-1);
    // The scene booted while a track was paused: nothing has played since.
    expect(vuFrame(null, 'paused', 5000, false, out)).toBeNull();
    expect(out).toEqual(off);
    expect(vuFrame(null, 'paused', 9000, true, out)).toBeNull();
    expect(out).toEqual(off);
  });

  it('runs its clock while a track plays and stops it while paused, so the strip stands still', () => {
    const out = new Array<number>(10);
    let clock = vuFrame(null, 'playing', 6000, false, out);
    expect(clock).toBe(6000);
    const playing = [...out];
    expect(playing.some((level) => level > 0)).toBe(true);
    clock = vuFrame(clock, 'paused', 9000, false, out);
    expect(clock).toBe(6000);
    expect(out).toEqual(playing);
    // Dark while a disc changes and when nothing is loaded; the clock is kept as it was.
    expect(vuFrame(clock, 'swapping', 9500, false, out)).toBe(6000);
    expect(out).toEqual(off);
    expect(vuFrame(clock, 'idle', 9600, false, out)).toBe(6000);
    expect(out).toEqual(off);
  });
});
