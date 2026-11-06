import { describe, expect, it } from 'vitest';
import { MODELS } from '../models';
import { SCENE_PROFILES } from './profiles';

describe('scene profiles', () => {
  it('gives every model a profile', () => {
    for (const model of MODELS) expect(SCENE_PROFILES[model.id], model.id).toBeDefined();
  });

  it('keeps the suitcase as it was framed and driven', () => {
    const { frame, arm, door } = SCENE_PROFILES.suitcase;
    expect(frame.target).toEqual([0, 0.132, 0.01]);
    const n = Math.hypot(-0.48, 0.338, 0.79);
    frame.direction.forEach((c, i) => expect(c).toBeCloseTo([-0.48, 0.338, 0.79][i] / n, 12));
    expect(frame.across).toBe(0.285);
    expect(frame.up).toBe(0.285);
    expect(arm).toEqual({ rest: 0, play: -0.52 });
    expect(door).toBeNull();
  });

  it('gives the Clear model a door, and a unit direction', () => {
    const { frame, door } = SCENE_PROFILES.clear;
    expect(door).not.toBeNull();
    expect(Math.hypot(...frame.direction)).toBeCloseTo(1, 12);
  });

  it('swings the Clear arm over the disc at +0.52 and its door out toward the viewer', () => {
    const { arm, door } = SCENE_PROFILES.clear;
    expect(arm).toEqual({ rest: 0, play: 0.52 });
    expect(door?.angle).toBeCloseTo(-(100 * Math.PI) / 180, 12);
  });
});
