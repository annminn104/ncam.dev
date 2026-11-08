import { describe, expect, it } from 'vitest';
import {
  DOUBLE_TAP_MS,
  DOUBLE_TAP_PX,
  dragOrbit,
  INITIAL_ORBIT,
  isDoubleTap,
  PITCH_LIMIT,
  resetOrbit,
  stepOrbit,
  YAW_LIMIT,
} from './orbit';

describe('orbit', () => {
  it('drags within ±25° yaw and ±10° pitch', () => {
    const far = dragOrbit(INITIAL_ORBIT, -100_000, 100_000, 1000);
    expect(far.targetYaw).toBe(YAW_LIMIT);
    expect(far.targetPitch).toBe(PITCH_LIMIT);
  });

  it('turns a canvas’s width of drag half a turn at 1×, and that divided by the zoom', () => {
    // Zoomed in 3×, the view swings on screen at 1×'s rate for the same drag.
    const one = dragOrbit(INITIAL_ORBIT, -50, 20, 1000);
    expect(one.targetYaw).toBeCloseTo((50 * Math.PI) / 1000, 12);
    expect(one.targetPitch).toBeCloseTo((20 * Math.PI) / 1000, 12);
    const three = dragOrbit(INITIAL_ORBIT, -50, 20, 1000, 3);
    expect(three.targetYaw).toBeCloseTo(one.targetYaw / 3, 12);
    expect(three.targetPitch).toBeCloseTo(one.targetPitch / 3, 12);
    expect(dragOrbit(INITIAL_ORBIT, -50, 20, 1000, 1)).toEqual(one);
  });

  it('eases toward the target and back after a reset', () => {
    let orbit = dragOrbit(INITIAL_ORBIT, -200, 0, 1000);
    for (let i = 0; i < 120; i++) orbit = stepOrbit(orbit, 1 / 60);
    expect(orbit.yaw).toBeCloseTo(orbit.targetYaw, 3);
    orbit = resetOrbit(orbit);
    for (let i = 0; i < 120; i++) orbit = stepOrbit(orbit, 1 / 60);
    expect(orbit.yaw).toBeCloseTo(0, 3);
  });
});

describe('double tap', () => {
  const tap = (at: number, x = 100, y = 400) => ({ at, x, y });

  it('is a second tap soon after the first, near it', () => {
    expect(isDoubleTap(tap(1000), tap(1180, 108, 395))).toBe(true);
  });

  it('needs a first tap', () => {
    expect(isDoubleTap(null, tap(1000))).toBe(false);
  });

  it('lets the second tap come within DOUBLE_TAP_MS, and no later', () => {
    expect(isDoubleTap(tap(1000), tap(1000 + DOUBLE_TAP_MS))).toBe(true);
    expect(isDoubleTap(tap(1000), tap(1000 + DOUBLE_TAP_MS + 1))).toBe(false);
  });

  it('lets the second tap land within DOUBLE_TAP_PX, measured in a straight line', () => {
    expect(isDoubleTap(tap(1000), tap(1100, 100 + DOUBLE_TAP_PX, 400))).toBe(true);
    expect(isDoubleTap(tap(1000), tap(1100, 100 + DOUBLE_TAP_PX + 1, 400))).toBe(false);
    // 20 px across and 20 down is 28 px away; 25 and 20 is 32.
    expect(isDoubleTap(tap(1000), tap(1100, 120, 420))).toBe(true);
    expect(isDoubleTap(tap(1000), tap(1100, 125, 420))).toBe(false);
  });

  it('is not a second tap that came before the first', () => {
    expect(isDoubleTap(tap(1000), tap(900))).toBe(false);
  });
});
