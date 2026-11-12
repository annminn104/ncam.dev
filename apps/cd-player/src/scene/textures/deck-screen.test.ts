import { describe, expect, it } from 'vitest';
import { playedBars, screenTimes, WAVE_BARS, waveHeights } from './deck-screen';
import { fnv1a } from './xorshift';

describe('fnv1a', () => {
  it('is the 32-bit FNV-1a hash', () => {
    expect(fnv1a('')).toBe(2166136261);
    expect(fnv1a('a')).toBe(3826002220);
    expect(fnv1a('foobar')).toBe(3214735720);
  });
});

describe('waveHeights', () => {
  it('is 120 heights in range, the same for the same id', () => {
    const bars = waveHeights('abc');
    expect(bars).toHaveLength(WAVE_BARS);
    for (const h of bars) {
      expect(h).toBeGreaterThanOrEqual(0.18);
      expect(h).toBeLessThanOrEqual(1);
    }
    expect(waveHeights('abc')).toEqual(bars);
  });

  it('differs between ids and is not flat', () => {
    const bars = waveHeights('abc');
    expect(waveHeights('abd')).not.toEqual(bars);
    expect(new Set(bars).size).toBeGreaterThan(1);
  });
});

describe('playedBars', () => {
  it('counts the bars the target has passed, held to 0..120', () => {
    expect(playedBars(0, 30_000)).toBe(0);
    expect(playedBars(15_000, 30_000)).toBe(60);
    expect(playedBars(30_000, 30_000)).toBe(120);
    expect(playedBars(45_000, 30_000)).toBe(120);
    expect(playedBars(-5, 30_000)).toBe(0);
  });

  it('is 0 without a duration', () => {
    expect(playedBars(10_000, 0)).toBe(0);
    expect(playedBars(10_000, NaN)).toBe(0);
  });
});

describe('screenTimes', () => {
  it('gives the elapsed and the remaining time as m:ss', () => {
    expect(screenTimes(0, 30_000)).toEqual({ elapsed: '0:00', remaining: '-0:30' });
    expect(screenTimes(42_000, 180_000)).toEqual({ elapsed: '0:42', remaining: '-2:18' });
  });

  it('has no remaining time without a duration', () => {
    expect(screenTimes(5_000, 0)).toEqual({ elapsed: '0:05', remaining: '-:--' });
  });
});
