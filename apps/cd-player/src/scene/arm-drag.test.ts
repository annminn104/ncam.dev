import { describe, expect, it } from 'vitest';
import type { Status } from '../playback/sequencer';
import { armDrags, armPointerAngle, armTakesDrag, type ArmDragRig } from './arm-drag';
import type { ToneArm } from './tonearm';

const ARM: ToneArm = { rest: 0, leadIn: -0.4, runOut: -0.8 };

/** An arm at -0.5 (a quarter of the way in); a pointer's angle round its pivot is its x (radians). */
function setup({ status = 'playing' as Status, durationMs = 200_000 } = {}) {
  const rig: ArmDragRig = { swapping: false, armDrag: null, dragMs: null };
  const view = { status, positionMs: 50_000, durationMs };
  const seeks: number[] = [];
  const drags = armDrags(rig, {
    arm: ARM,
    angleNow: () => -0.5,
    pointerAngle: (x) => (Number.isNaN(x) ? null : x),
    view: () => view,
    seek: (deltaMs) => seeks.push(deltaMs),
  });
  return { rig, view, seeks, drags };
}

describe('armDrags', () => {
  it('lifts the arm where it is on a press, and follows the pointer’s turn round the pivot', () => {
    const { rig, drags } = setup();
    drags.down(1, 0, 0, 0);
    expect(rig.armDrag).toBe(-0.5);
    expect(rig.dragMs).toBe(50_000);
    drags.move(1, -0.1, 0, 0, false);
    expect(rig.armDrag).toBeCloseTo(-0.6, 12);
    expect(rig.dragMs).toBe(100_000);
  });

  it('holds the arm between the lead-in and the run-out', () => {
    const { rig, drags } = setup();
    drags.down(1, 0, 0, 0);
    drags.move(1, -1, 0, 0, false);
    expect([rig.armDrag, rig.dragMs]).toEqual([-0.8, 200_000]);
    drags.move(1, 1, 0, 0, false);
    expect([rig.armDrag, rig.dragMs]).toEqual([-0.4, 0]);
  });

  it('seeks once on the release, by the target less the position then, and lets the arm drop', () => {
    const { rig, view, seeks, drags } = setup();
    drags.down(1, 0, 0, 0);
    drags.move(1, -0.1, 0, 0, false);
    view.positionMs = 51_000;
    drags.up(1, 0);
    drags.up(1, 0);
    expect(seeks).toEqual([49_000]);
    expect([rig.armDrag, rig.dragMs]).toEqual([null, null]);
  });

  it('seeks nothing for a release where the track already is', () => {
    const { seeks, drags } = setup();
    drags.down(1, 0, 0, 0);
    drags.up(1, 0);
    expect(seeks).toEqual([]);
  });

  it('takes no drag without a track, without its duration, or while a change runs', () => {
    expect(armTakesDrag({ swapping: false }, { status: 'playing', durationMs: 1 })).toBe(true);
    expect(armTakesDrag({ swapping: false }, { status: 'paused', durationMs: 1 })).toBe(true);
    for (const status of ['idle', 'swapping'] as const) {
      const { rig, drags } = setup({ status });
      drags.down(1, 0, 0, 0);
      expect(rig.armDrag, status).toBeNull();
    }
    const unknown = setup({ durationMs: 0 });
    unknown.drags.down(1, 0, 0, 0);
    expect(unknown.rig.armDrag).toBeNull();
    const changing = setup();
    changing.rig.swapping = true;
    changing.drags.down(1, 0, 0, 0);
    expect(changing.rig.armDrag).toBeNull();
  });

  it.each([
    ['cancelled', (d: ReturnType<typeof setup>['drags']) => d.cancel(1)],
    [
      'with its release lost',
      (d: ReturnType<typeof setup>['drags']) => d.move(1, -0.2, 0, 0, true),
    ],
    ['become a pinch', (d: ReturnType<typeof setup>['drags']) => d.up(1, 1)],
  ])('puts the arm back and seeks nothing, %s', (_, end) => {
    const { rig, seeks, drags } = setup();
    drags.down(1, 0, 0, 0);
    drags.move(1, -0.1, 0, 0, false);
    end(drags);
    drags.up(1, 0);
    expect([rig.armDrag, rig.dragMs]).toEqual([null, null]);
    expect(seeks).toEqual([]);
  });

  it('ends a drag a change begins under where it stands, seeking nothing on the lift', () => {
    const { rig, seeks, drags } = setup();
    drags.down(1, 0, 0, 0);
    drags.move(1, -0.1, 0, 0, false);
    rig.swapping = true;
    drags.frame();
    expect([rig.armDrag, rig.dragMs]).toEqual([null, null]);
    drags.up(1, 0);
    expect(seeks).toEqual([]);
  });

  it('reads a pointer’s angle round the pivot as the arm’s own turn about Y', () => {
    // toBeCloseTo, not toBe: atan2(-0, 1) is -0, which Object.is tells from 0.
    expect(armPointerAngle({ x: 1, z: 0 }, { x: 0, z: 0 })).toBeCloseTo(0, 12);
    // rotation.y turns +X toward -Z.
    expect(armPointerAngle({ x: 0, z: -1 }, { x: 0, z: 0 })).toBeCloseTo(Math.PI / 2, 12);
    expect(armPointerAngle({ x: 2, z: 1 }, { x: 1, z: 1 })).toBeCloseTo(0, 12);
  });
});
