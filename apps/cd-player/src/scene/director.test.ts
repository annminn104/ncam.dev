import { describe, expect, it } from 'vitest';
import { ARM_PLAY, ARM_REST, DURATION, restingPose, swapPose } from './director';

describe('swapPose: insert (the first play)', () => {
  it('starts with the disc in the closed case and the arm at rest, raised', () => {
    const pose = swapPose('insert', 0);
    expect(pose.newDisc).toEqual({ along: 1, rise: 0 });
    expect(pose.newCase).toEqual({ slide: 0, open: 0 });
    expect(pose.armAngle).toBe(ARM_REST);
    expect(pose.oldDisc).toBeNull();
  });

  it('ends with the disc seated, the case closed and the arm down on the disc', () => {
    const pose = swapPose('insert', DURATION.insert);
    expect(pose.newDisc?.along).toBe(0);
    expect(pose.newCase.open).toBeCloseTo(0);
    expect(pose.armAngle).toBeCloseTo(ARM_PLAY);
    expect(pose.armLift).toBeCloseTo(0);
    expect(pose.spin).toBeCloseTo(1);
  });

  it('flies the disc out of the case, never backwards', () => {
    let last = 1;
    for (let t = 0; t <= DURATION.insert; t += 50) {
      const along = swapPose('insert', t).newDisc?.along ?? 1;
      expect(along).toBeLessThanOrEqual(last + 1e-9);
      last = along;
    }
  });
});

describe('swapPose: change', () => {
  it('starts on the disc, sends the old disc home, slides the cases, seats the new disc', () => {
    expect(swapPose('change', 0)).toMatchObject({
      armAngle: ARM_PLAY,
      oldDisc: { along: 0 },
      newCase: { slide: 1 },
    });
    expect(swapPose('change', 1350).oldDisc?.along).toBeCloseTo(1);
    const swapped = swapPose('change', 1950);
    expect(swapped.oldDisc).toBeNull();
    expect(swapped.oldCase).toBeNull();
    expect(swapped.newCase.slide).toBeCloseTo(0);
    const end = swapPose('change', DURATION.change);
    expect(end.newDisc?.along).toBe(0);
    expect(end.armAngle).toBeCloseTo(ARM_PLAY);
    expect(end.newCase.open).toBeCloseTo(0);
  });

  it('clamps outside its time', () => {
    expect(swapPose('change', -10)).toEqual(swapPose('change', 0));
    expect(swapPose('change', 99_999)).toEqual(swapPose('change', DURATION.change));
  });
});

describe('restingPose', () => {
  it('rests the arm unless a disc is seated and loaded, and spins only while playing', () => {
    expect(restingPose(false, false, false)).toMatchObject({
      armAngle: ARM_REST,
      spin: 0,
      newDisc: { along: 1 },
    });
    expect(restingPose(true, true, false)).toMatchObject({
      armAngle: ARM_PLAY,
      spin: 0,
      newDisc: { along: 0 },
    });
    expect(restingPose(true, true, true).spin).toBe(1);
    expect(restingPose(true, false, false).armAngle).toBe(ARM_REST);
  });
});
