import { describe, expect, it } from 'vitest';
import { dragOrbit, INITIAL_ORBIT, PITCH_LIMIT, resetOrbit, stepOrbit, YAW_LIMIT } from './orbit';

describe('orbit', () => {
  it('drags within ±25° yaw and ±10° pitch', () => {
    const far = dragOrbit(INITIAL_ORBIT, -100_000, 100_000, 1000);
    expect(far.targetYaw).toBe(YAW_LIMIT);
    expect(far.targetPitch).toBe(PITCH_LIMIT);
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
