import { describe, expect, it } from 'vitest';
import { squareToPosition } from '../../game/coords';
import {
  DISTANCE,
  POLAR,
  azimuthOf,
  framingFit,
  homePosition,
  nearestAzimuth,
  viewSideOf,
} from './rig-math';

describe('homePosition', () => {
  it('stands white behind the white pieces, high enough to look down at the board', () => {
    const [x, y, z] = homePosition('w');
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(DISTANCE * Math.cos(POLAR));
    expect(y).toBeGreaterThan(0);
    // White's back rank is at +z (see squareToPosition).
    expect(z).toBeCloseTo(DISTANCE * Math.sin(POLAR));
    expect(Math.sign(z)).toBe(Math.sign(squareToPosition('e1')[1]));
  });

  it('turns to the far end for black, mirroring white across the board', () => {
    const [wx, wy, wz] = homePosition('w');
    const [bx, by, bz] = homePosition('b');
    expect(bx).toBeCloseTo(-wx);
    expect(by).toBeCloseTo(wy);
    expect(bz).toBeCloseTo(-wz);
    expect(Math.sign(bz)).toBe(Math.sign(squareToPosition('e8')[1]));
  });

  it('is DISTANCE from the board centre whichever end it stands at', () => {
    for (const side of ['w', 'b'] as const) {
      const [x, y, z] = homePosition(side);
      expect(Math.hypot(x, y, z)).toBeCloseTo(DISTANCE);
    }
  });
});

describe('framingFit', () => {
  it('leaves landscape screens at the plain distance', () => {
    for (const aspect of [1.5, 1.6, 16 / 9, 2.4]) expect(framingFit(aspect)).toBe(1);
  });

  it('pulls back in proportion as the screen narrows, so the board keeps its width on screen', () => {
    expect(framingFit(1)).toBeCloseTo(1.5);
    expect(framingFit(0.75)).toBeCloseTo(2);
    // A phone held upright (375x812).
    expect(framingFit(375 / 812)).toBeCloseTo(3.25, 1);
    expect(framingFit(0.5) * 0.5).toBeCloseTo(framingFit(1) * 1);
  });

  it('survives a screen with no size yet', () => {
    for (const aspect of [0, -1, NaN]) expect(framingFit(aspect)).toBe(1);
  });

  it('scales the home position along the same line of sight', () => {
    const [, y, z] = homePosition('w');
    const [fx, fy, fz] = homePosition('w', 2);
    expect(fx).toBeCloseTo(0);
    expect(fy).toBeCloseTo(2 * y);
    expect(fz).toBeCloseTo(2 * z);
    expect(Math.hypot(fx, fy, fz)).toBeCloseTo(DISTANCE * 2);
  });
});

describe('nearestAzimuth', () => {
  const TAU = Math.PI * 2;

  it('leaves a target that is already the nearest turn alone', () => {
    expect(nearestAzimuth(0.3, 0)).toBe(0);
    expect(nearestAzimuth(Math.PI - 0.1, Math.PI)).toBe(Math.PI);
  });

  it('takes the short way round after the player has spun the board', () => {
    // 3.9 turns forwards: facing 0 again is a tenth of a turn on (4 turns), not 3.9 turns back.
    expect(nearestAzimuth(3.9 * TAU, 0)).toBeCloseTo(4 * TAU);
    // 1.25 turns backwards (-2.5π): the nearest π is -3π, a quarter turn further back, not -π.
    expect(nearestAzimuth(-1.25 * TAU, Math.PI)).toBeCloseTo(Math.PI - 2 * TAU);
  });

  it('never asks for more than half a turn of movement', () => {
    for (let current = -20; current <= 20; current += 0.37) {
      for (const side of ['w', 'b'] as const) {
        const target = nearestAzimuth(current, azimuthOf(side));
        expect(Math.abs(target - current)).toBeLessThanOrEqual(Math.PI + 1e-9);
        // Still the same direction on the dial: a whole number of turns from the target side.
        expect((target - azimuthOf(side)) / TAU).toBeCloseTo(
          Math.round((target - azimuthOf(side)) / TAU),
        );
      }
    }
  });
});

describe('viewSideOf', () => {
  const TAU = Math.PI * 2;

  it('names the end of the board the camera stands at', () => {
    expect(viewSideOf(azimuthOf('w'), 'b')).toBe('w');
    expect(viewSideOf(azimuthOf('b'), 'w')).toBe('b');
    // Turns the player has spun the board count for nothing.
    expect(viewSideOf(3 * TAU + 0.4, 'b')).toBe('w');
    expect(viewSideOf(-2 * TAU + Math.PI - 0.4, 'w')).toBe('b');
  });

  it('keeps its last answer while the camera looks at the board side-on', () => {
    for (const azimuth of [Math.PI / 2, -Math.PI / 2, Math.PI / 2 + 0.1, 1.5 * Math.PI - 0.1]) {
      expect(viewSideOf(azimuth, 'w')).toBe('w');
      expect(viewSideOf(azimuth, 'b')).toBe('b');
    }
  });

  it('changes its answer once the camera is clearly past the side-on view', () => {
    expect(viewSideOf(Math.PI / 2 + 0.3, 'w')).toBe('b');
    expect(viewSideOf(Math.PI / 2 - 0.3, 'b')).toBe('w');
  });
});
