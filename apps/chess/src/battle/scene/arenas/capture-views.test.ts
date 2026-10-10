import { describe, expect, it } from 'vitest';
import type { ArenaId } from '../../../arenas-meta';
import type { CaptureView } from '../CaptureCamera';
import { POLAR, homePosition } from '../rig-math';
import { BLOOD_MOON_SKY } from './BloodMoon';
import { CLOUD_PEAK_SKY } from './CloudPeak';
import { ARENA_DEFS } from './index';
import { LOTUS_LAKE_SKY } from './LotusLake';
import type { SkyLook } from './common';

// The lobby previews (capture mode) are 16:10 frames that must show the board and the arena's
// sun or moon; the player's resting camera looks down on the board and never shows the sky.
type Vec = [number, number, number];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec): Vec => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

const ASPECT = 16 / 10;
const RAD = Math.PI / 180;

/** Where a direction from the camera lands in its frame: x and y in -1..1 when inside. */
function project(view: CaptureView, dir: Vec) {
  const forward = unit(sub(view.target, view.position));
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const tan = Math.tan(((view.fov ?? 40) / 2) * RAD);
  const depth = dot(dir, forward);
  return {
    ahead: depth > 0,
    x: dot(dir, right) / depth / (tan * ASPECT),
    y: dot(dir, up) / depth / tan,
  };
}

/** How far the disc's centre may sit from the frame's centre so the whole disc is inside. */
function inside(view: CaptureView, sky: SkyLook) {
  const disc = sky.disc!;
  const p = project(view, unit(disc.dir));
  // The disc's radius as a share of the half-frame, vertically (the tighter of the two).
  const margin = Math.tan(disc.radius * RAD) / Math.tan(((view.fov ?? 40) / 2) * RAD);
  return p.ahead && Math.abs(p.x) <= 1 - margin / ASPECT && Math.abs(p.y) <= 1 - margin;
}

const SKIES: Record<ArenaId, SkyLook> = {
  'cloud-peak': CLOUD_PEAK_SKY,
  'blood-moon': BLOOD_MOON_SKY,
  'lotus-lake': LOTUS_LAKE_SKY,
};

describe('lobby preview cameras', () => {
  for (const [id, sky] of Object.entries(SKIES) as [ArenaId, SkyLook][]) {
    const view = ARENA_DEFS[id].capture;

    it(`${id}: frames the whole sun or moon`, () => {
      expect(sky.disc).toBeDefined();
      expect(inside(view, sky)).toBe(true);
    });

    it(`${id}: frames the board's centre, below the disc`, () => {
      const board = project(view, unit(sub([0, 0, 0], view.position)));
      const disc = project(view, unit(sky.disc!.dir));
      expect(board.ahead).toBe(true);
      expect(Math.abs(board.x)).toBeLessThan(0.5);
      expect(Math.abs(board.y)).toBeLessThan(0.9);
      expect(disc.y).toBeGreaterThan(board.y);
    });
  }

  it('are needed: the resting view shows none of the discs', () => {
    const rest: CaptureView = {
      position: homePosition('w'),
      target: [0, 0, 0],
      fov: 40,
    };
    // Sanity: the resting camera is the rig's, polar POLAR from straight up.
    expect(Math.acos(rest.position[1] / Math.hypot(...rest.position))).toBeCloseTo(POLAR);
    for (const sky of Object.values(SKIES)) expect(inside(rest, sky)).toBe(false);
  });
});
