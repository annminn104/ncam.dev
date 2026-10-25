import { describe, expect, it } from 'vitest';
import { homeView } from './CaptureCamera';
import { DISTANCE, framingFit, homePosition } from './rig-math';

// The review's `home` view is where the rig rests for white, on this screen: the rig pulls back by
// framingFit on a narrow one (CameraRig.tsx), so a phone's capture shows what a phone player sees.
describe('homeView', () => {
  it('is the rig’s resting view for white on a landscape screen, at the plain distance', () => {
    const view = homeView(1.6);
    expect(view.position).toEqual(homePosition('w'));
    expect(Math.hypot(...view.position)).toBeCloseTo(DISTANCE);
    expect(view.target).toEqual([0, 0, 0]);
    expect(view.fov).toBe(40);
  });

  it('pulls back on a phone held upright, as far as the rig does', () => {
    const phone = 375 / 812;
    const view = homeView(phone);
    expect(view.position).toEqual(homePosition('w', framingFit(phone)));
    expect(framingFit(phone)).toBeCloseTo(3.25, 1);
    expect(Math.hypot(...view.position)).toBeCloseTo(DISTANCE * framingFit(phone));
    // The same line of sight as on a landscape screen, only farther along it.
    const [x, y, z] = homeView(1.6).position;
    const [px, py, pz] = view.position;
    expect(px).toBeCloseTo(x * framingFit(phone));
    expect(py).toBeCloseTo(y * framingFit(phone));
    expect(pz).toBeCloseTo(z * framingFit(phone));
    expect(view.target).toEqual([0, 0, 0]);
    expect(view.fov).toBe(40);
  });

  it('pulls back in between, and keeps a wide screen at the plain distance', () => {
    expect(Math.hypot(...homeView(1).position)).toBeCloseTo(DISTANCE * 1.5);
    expect(homeView(16 / 9).position).toEqual(homePosition('w'));
  });

  it('survives a screen with no size yet', () => {
    for (const aspect of [0, NaN]) expect(homeView(aspect).position).toEqual(homePosition('w'));
  });
});
