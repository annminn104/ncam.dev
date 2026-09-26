import { describe, expect, it } from 'vitest';
import { createShowcase } from './showcase';

describe('createShowcase', () => {
  it('starts inactive until started', () => {
    const s = createShowcase({ durationMs: 1000 });
    expect(s.isActive()).toBe(false);
    expect(s.valueAt(500)).toEqual({ x: 0, y: 0 });
  });

  it('sweeps and returns to centre over its duration', () => {
    const s = createShowcase({ durationMs: 1000 });
    s.start(0);
    expect(s.isActive()).toBe(true);
    const mid = s.valueAt(250);
    expect(Math.abs(mid.x)).toBeGreaterThan(0.1);
    const end = s.valueAt(999);
    expect(Math.abs(end.x)).toBeLessThan(0.01);
    expect(Math.abs(end.y)).toBeLessThan(0.01);
  });

  it('finishes once its duration elapses', () => {
    const s = createShowcase({ durationMs: 1000 });
    s.start(0);
    s.valueAt(1001);
    expect(s.isActive()).toBe(false);
    s.start(2000);
    expect(s.isActive()).toBe(false);
  });

  it('finishes exactly at its duration, not one frame past it', () => {
    // The guard is `elapsed >= durationMs`. Relaxing it to `>` leaves the
    // sweep live for one more sample at exactly t = duration, where the
    // envelope is sin(PI) — a denormal rather than a clean zero — so the
    // handover to the pointer spring starts from a nonzero offset.
    const s = createShowcase({ durationMs: 1000 });
    s.start(0);
    expect(s.valueAt(1000)).toEqual({ x: 0, y: 0 });
    expect(s.isActive()).toBe(false);
  });

  it('cancels on real pointer input and never replays', () => {
    const s = createShowcase({ durationMs: 1000 });
    s.start(0);
    s.cancel();
    expect(s.isActive()).toBe(false);
    expect(s.valueAt(250)).toEqual({ x: 0, y: 0 });
    s.start(0);
    expect(s.isActive()).toBe(false);
  });

  it('never starts when it is disabled', () => {
    const s = createShowcase({ durationMs: 1000, enabled: false });
    s.start(0);
    expect(s.isActive()).toBe(false);
  });

  it('stays within the unit range throughout', () => {
    const s = createShowcase({ durationMs: 1000 });
    s.start(0);
    for (let t = 0; t <= 1000; t += 50) {
      const v = s.valueAt(t);
      expect(Math.abs(v.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(v.y)).toBeLessThanOrEqual(1);
    }
  });
});
