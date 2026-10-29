import { describe, expect, it } from 'vitest';
import { frameDistance, frameFor } from './framing';

const dist = (f: ReturnType<typeof frameFor>) =>
  Math.hypot(f.position[0] - f.target[0], f.position[1] - f.target[1], f.position[2] - f.target[2]);

describe('framing', () => {
  it('backs off as the view narrows', () => {
    expect(frameDistance(9 / 16)).toBeGreaterThan(frameDistance(16 / 9));
    expect(frameDistance(16 / 9)).toBeCloseTo(frameDistance(2), 5);
  });

  it('looks from the hero still: front left, above', () => {
    const f = frameFor(16 / 9, true);
    expect(f.position[0]).toBeLessThan(f.target[0]);
    expect(f.position[1]).toBeGreaterThan(f.target[1]);
    expect(f.position[2]).toBeGreaterThan(f.target[2]);
  });

  it('moves the target right on wide screens, so the player sits clear of the drawer', () => {
    expect(frameFor(16 / 9, true).target[0]).toBeGreaterThan(frameFor(16 / 9, false).target[0]);
  });

  it('orbits at a constant distance, pitch raising the eye', () => {
    const base = frameFor(16 / 9, true);
    const turned = frameFor(16 / 9, true, 0.3, 0.1);
    expect(dist(turned)).toBeCloseTo(dist(base), 6);
    expect(turned.position[1]).toBeGreaterThan(base.position[1]);
  });
});
