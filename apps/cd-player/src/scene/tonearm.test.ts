import { describe, expect, it } from 'vitest';
import { ARM_PLAY, ARM_REST } from './director';
import {
  directorAngle,
  grooveAngle,
  grooveMs,
  grooveShare,
  inGrooves,
  toneArmOf,
  type ToneArm,
} from './tonearm';

const ARM: ToneArm = { rest: 0, leadIn: -0.4, runOut: -0.8 };

describe('the tonearm', () => {
  it('is a turntable profile’s arm, and none on a CD player', () => {
    expect(toneArmOf({ media: 'vinyl', arm: { rest: 0, play: -0.4, runOut: -0.8 } })).toEqual(ARM);
    expect(toneArmOf({ media: 'cd', arm: { rest: 0, play: -0.52 } })).toBeNull();
    expect(() => toneArmOf({ media: 'vinyl', arm: { rest: 0, play: -0.4 } })).toThrow('run-out');
  });

  it('stands at the lead-in at 0:00 and at the run-out at the end, in step between', () => {
    expect(grooveAngle(ARM, grooveShare(0, 200_000))).toBe(-0.4);
    expect(grooveAngle(ARM, grooveShare(100_000, 200_000))).toBeCloseTo(-0.6, 12);
    expect(grooveAngle(ARM, grooveShare(200_000, 200_000))).toBeCloseTo(-0.8, 12);
    expect(grooveShare(250_000, 200_000)).toBe(1);
    expect(grooveShare(-5, 200_000)).toBe(0);
    expect(grooveShare(10_000, 0)).toBe(0);
    expect(grooveShare(10_000, Number.NaN)).toBe(0);
  });

  it('holds an angle between the lead-in and the run-out, whichever way they lie', () => {
    expect(inGrooves(ARM, 0)).toBe(-0.4);
    expect(inGrooves(ARM, -1)).toBe(-0.8);
    expect(inGrooves(ARM, -0.5)).toBe(-0.5);
    expect(inGrooves({ rest: 0, leadIn: 0.4, runOut: 0.8 }, 1)).toBe(0.8);
  });

  it('drops the needle at the held angle’s share of the duration, in whole ms', () => {
    expect(grooveMs(ARM, -0.6, 200_000)).toBe(100_000);
    expect(grooveMs(ARM, 0.3, 200_000)).toBe(0);
    expect(grooveMs(ARM, -2, 200_000)).toBe(200_000);
    expect(grooveMs(ARM, -0.5, 1001)).toBe(250);
    expect(grooveMs(ARM, -0.7, 0)).toBe(0);
  });

  it('turns the model’s angle into the director’s: the rest is ARM_REST, the lead-in ARM_PLAY', () => {
    expect(directorAngle(ARM, 0)).toBe(ARM_REST);
    expect(directorAngle(ARM, -0.4)).toBeCloseTo(ARM_PLAY, 12);
    expect(directorAngle(ARM, -0.8)).toBeCloseTo(2 * ARM_PLAY, 12);
  });
});
