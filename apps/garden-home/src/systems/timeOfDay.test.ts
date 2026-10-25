import { describe, expect, it } from 'vitest';
import { Color, Vector3 } from 'three';
import {
  cloneSky,
  computeSky,
  keyLight,
  mixSky,
  MOON_COLOR,
  MOON_DIR,
  MOON_INTENSITY,
  resolveNow,
} from './timeOfDay';

const SKY = { sunrise: '06:00', sunset: '18:00' };
const at = (hours: number, minutes = 0) => new Date(2026, 9, 15, hours, minutes);
const lightness = (c: { getHSL: (t: { h: number; s: number; l: number }) => { l: number } }) =>
  c.getHSL({ h: 0, s: 0, l: 0 }).l;

describe('computeSky', () => {
  it('noon is full day with a high, bright sun', () => {
    const s = computeSky(at(12), SKY);
    expect(s.nightFactor).toBe(0);
    expect(s.sunIntensity).toBeCloseTo(3);
    expect(s.sunDir.y).toBeGreaterThan(0.85);
  });

  it('midnight is full night with the sun off', () => {
    const s = computeSky(at(0), SKY);
    expect(s.nightFactor).toBe(1);
    expect(s.sunIntensity).toBe(0);
    expect(s.elevationDeg).toBeCloseTo(-20);
  });

  it('sunrise and sunset sit on the horizon', () => {
    for (const hour of [6, 18]) {
      const s = computeSky(at(hour), SKY);
      expect(s.elevationDeg).toBeCloseTo(0);
      expect(s.nightFactor).toBeCloseTo(0.5);
    }
  });

  it('nightFactor never decreases from noon to midnight', () => {
    let previous = -1;
    for (let minutes = 12 * 60; minutes < 24 * 60; minutes += 10) {
      const n = computeSky(at(0, minutes), SKY).nightFactor;
      expect(n).toBeGreaterThanOrEqual(previous);
      previous = n;
    }
  });

  it('respects custom sunrise and sunset', () => {
    expect(computeSky(at(5, 30), { sunrise: '05:30', sunset: '19:00' }).nightFactor).toBeCloseTo(
      0.5,
    );
  });

  it('the sky is darker at night', () => {
    expect(lightness(computeSky(at(0), SKY).skyTop)).toBeLessThan(
      lightness(computeSky(at(12), SKY).skyTop),
    );
  });
});

describe('mixSky', () => {
  it('moves toward the target and reports while moving', () => {
    const current = cloneSky(computeSky(at(12), SKY));
    const target = computeSky(at(0), SKY);
    expect(mixSky(current, target, 0.5)).toBe(true);
    expect(current.nightFactor).toBeCloseTo(0.5);
  });

  it('reports false once settled and k=1 lands on the target', () => {
    const target = computeSky(at(0), SKY);
    const current = cloneSky(computeSky(at(12), SKY));
    mixSky(current, target, 1);
    expect(current.nightFactor).toBeCloseTo(target.nightFactor);
    expect(mixSky(current, target, 0.5)).toBe(false);
  });

  it('reports true near noon while only the sun direction is moving', () => {
    const current = cloneSky(computeSky(at(12, 0), SKY));
    const target = computeSky(at(12, 1), SKY);
    expect(mixSky(current, target, 0.5)).toBe(true);
  });
});

describe('resolveNow', () => {
  it('applies the override to today and keeps the real time otherwise', () => {
    const now = new Date(2026, 9, 15, 9, 41, 7);
    const d = resolveNow({ hours: 21, minutes: 5 }, now);
    expect([
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
    ]).toEqual([2026, 9, 15, 21, 5, 0]);
    expect(resolveNow(null, now)).toBe(now);
  });
});

describe('keyLight', () => {
  const light = () => ({ dir: new Vector3(), color: new Color(), intensity: 0 });

  it('is the sun by day', () => {
    const s = computeSky(at(12), SKY);
    const k = keyLight(s, light());
    expect(k.dir.equals(s.sunDir)).toBe(true);
    expect(k.color.equals(s.sunColor)).toBe(true);
    expect(k.intensity).toBe(s.sunIntensity);
  });

  it('is the moon at night: high, in front of the house, cool and dim', () => {
    const k = keyLight(computeSky(at(0), SKY), light());
    expect(k.dir.equals(MOON_DIR)).toBe(true);
    expect(k.color.equals(MOON_COLOR)).toBe(true);
    expect(k.intensity).toBe(MOON_INTENSITY);
    expect(MOON_DIR.y).toBeGreaterThan(0.6); // roofs shade the rooms below
    expect(MOON_DIR.z).toBeGreaterThan(0); // the front of the house (+z in three space) catches it
    expect(MOON_COLOR.b).toBeGreaterThan(MOON_COLOR.r);
  });

  it('never leaves the yard without a key light through dusk and dawn', () => {
    for (let minutes = 0; minutes < 24 * 60; minutes += 5) {
      const k = keyLight(computeSky(at(0, minutes), SKY), light());
      expect(k.intensity).toBeGreaterThan(0.1);
    }
  });
});
