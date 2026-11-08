import { describe, expect, it } from 'vitest';
import {
  clampPan,
  clampZoom,
  INITIAL_ZOOM,
  NO_PAN,
  resetZoom,
  stepZoom,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  zoomBy,
  zoomLimits,
  type Pan,
  type Zoom,
} from './zoom';

/** The suitcase's frame: 0.285 m round its aim each way (src/scene/profiles.ts). */
const BOUNDS = { across: 0.285, up: 0.285 };
/** What a 16:9 canvas shows of the aim's plane at 1× (metres): half its width, half its height. */
const VIEW = { x: 0.525, y: 0.295 };

type Point = { x: number; y: number };

/**
 * The point of the aim's plane under a canvas point (normalised, −1 to 1) at a zoom and a pan,
 * with the orbit at its middle: the pan, plus the point's share of the view, which the lens divides
 * by the zoom.
 */
const pointUnder = (p: Point, zoom: number, pan: Pan): Pan => [
  pan[0] + (p.x * VIEW.x) / zoom,
  pan[1] + (p.y * VIEW.y) / zoom,
];

/**
 * The pan that keeps the point under `p` (in the target view of `state`) under it at a zoom, as
 * framing.ts panKeeping answers with the orbit at its middle.
 */
const keeping =
  (state: Zoom, p: Point) =>
  (zoom: number): Pan => {
    const [x, y] = pointUnder(p, state.targetZoom, state.targetPan);
    return [x - (p.x * VIEW.x) / zoom, y - (p.y * VIEW.y) / zoom];
  };
/** The view's centre: the buttons and the keys keep the pan. */
const centre = (state: Zoom) => () => state.targetPan;

const settle = (state: Zoom, frames = 240) => {
  let next = state;
  for (let i = 0; i < frames; i++) next = stepZoom(next, 1 / 60);
  return next;
};

describe('zoom', () => {
  it('magnifies between 1× and 3×, a step being ×1.25', () => {
    expect([ZOOM_MIN, ZOOM_MAX, ZOOM_STEP]).toEqual([1, 3, 1.25]);
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(7)).toBe(3);
    expect(INITIAL_ZOOM).toEqual({ zoom: 1, pan: [0, 0], targetZoom: 1, targetPan: [0, 0] });
  });

  it('steps by ×1.25 toward the view’s centre and stops at either end', () => {
    let state = INITIAL_ZOOM;
    for (let i = 0; i < 4; i++) state = zoomBy(state, ZOOM_STEP, centre(state), BOUNDS);
    expect(state.targetZoom).toBeCloseTo(ZOOM_STEP ** 4, 12);
    state = zoomBy(state, ZOOM_STEP, centre(state), BOUNDS);
    expect(state.targetZoom).toBe(ZOOM_MAX);
    expect(zoomBy(state, ZOOM_STEP, centre(state), BOUNDS).targetZoom).toBe(ZOOM_MAX);
    for (let i = 0; i < 5; i++) state = zoomBy(state, 1 / ZOOM_STEP, centre(state), BOUNDS);
    expect(state.targetZoom).toBe(ZOOM_MIN);
    expect(state.targetPan).toEqual(NO_PAN);
    // An input moves the target alone: the frames ease toward it.
    expect(state.zoom).toBe(1);
  });

  it('keeps the point under the pointer where it is', () => {
    const at = { x: 0.3, y: -0.2 };
    let state = INITIAL_ZOOM;
    for (let i = 0; i < 3; i++) {
      const before = pointUnder(at, state.targetZoom, state.targetPan);
      state = zoomBy(state, ZOOM_STEP, keeping(state, at), BOUNDS);
      const after = pointUnder(at, state.targetZoom, state.targetPan);
      expect(after[0]).toBeCloseTo(before[0], 12);
      expect(after[1]).toBeCloseTo(before[1], 12);
    }
    expect(state.targetZoom).toBeCloseTo(ZOOM_STEP ** 3, 12);
    // Toward the pointer: the pan moved its way, right and down.
    expect(state.targetPan[0]).toBeGreaterThan(0);
    expect(state.targetPan[1]).toBeLessThan(0);
  });

  it('holds the pan within (1 − 1/zoom) of the frame’s half-size each way: none at 1×', () => {
    expect(clampPan([0.4, -0.4], 1, BOUNDS)).toEqual(NO_PAN);
    const corner = clampPan([0.4, -0.4], 3, BOUNDS);
    expect(corner[0]).toBeCloseTo((2 / 3) * 0.285, 12);
    expect(corner[1]).toBeCloseTo(-(2 / 3) * 0.285, 12);
    expect(clampPan([0.05, -0.02], 2, BOUNDS)).toEqual([0.05, -0.02]);
    // Each axis by its own half-size: the Clear's frame is wider than it is tall.
    const clear = clampPan([1, 1], 2, { across: 0.362, up: 0.284 });
    expect(clear[0]).toBeCloseTo(0.181, 12);
    expect(clear[1]).toBeCloseTo(0.142, 12);
  });

  it('stops the frame at the model: a point beyond the clamp slides', () => {
    // At the canvas's right edge, 0.525 m out at 1×: the pan that would keep it is past the room.
    const state = zoomBy(INITIAL_ZOOM, 2, keeping(INITIAL_ZOOM, { x: 1, y: 0 }), BOUNDS);
    expect(state.targetZoom).toBe(2);
    expect(state.targetPan[0]).toBeCloseTo(0.5 * 0.285, 12);
    expect(state.targetPan[1]).toBe(0);
  });

  it('slides the frame back as the zoom comes out, to no pan at 1×', () => {
    let state: Zoom = { ...INITIAL_ZOOM, targetZoom: 3, targetPan: clampPan([1, 1], 3, BOUNDS) };
    state = zoomBy(state, 1 / ZOOM_STEP, centre(state), BOUNDS);
    expect(state.targetZoom).toBeCloseTo(2.4, 12);
    expect(state.targetPan[0]).toBeCloseTo((1 - 1 / 2.4) * 0.285, 12);
    expect(state.targetPan[1]).toBeCloseTo((1 - 1 / 2.4) * 0.285, 12);
    for (let i = 0; i < 5; i++) state = zoomBy(state, 1 / ZOOM_STEP, centre(state), BOUNDS);
    expect(state.targetZoom).toBe(1);
    expect(state.targetPan).toEqual(NO_PAN);
  });

  it('eases toward its target at 6 per second, as the orbit does, and settles on it', () => {
    const asked = zoomBy(INITIAL_ZOOM, 2, centre(INITIAL_ZOOM), BOUNDS);
    const once = stepZoom(asked, 0.1);
    // The lens's reach (1 / zoom) has gone 1 − e^−0.6 of its way.
    const share = 1 - Math.exp(-0.6);
    expect(1 / once.zoom).toBeCloseTo(1 + (1 / 2 - 1) * share, 12);
    expect(once.targetZoom).toBe(2);
    const settled = settle(asked);
    expect(settled.zoom).toBe(2);
    expect(settled.pan).toEqual(settled.targetPan);
  });

  it('keeps the zoomed point under the pointer all the way there', () => {
    const at = { x: -0.5, y: 0.4 };
    const asked = zoomBy(INITIAL_ZOOM, 1.6, keeping(INITIAL_ZOOM, at), BOUNDS);
    const point = pointUnder(at, 1, NO_PAN);
    let state = asked;
    for (let i = 0; i < 60; i++) {
      state = stepZoom(state, 1 / 60);
      const now = pointUnder(at, state.zoom, state.pan);
      expect(now[0]).toBeCloseTo(point[0], 12);
      expect(now[1]).toBeCloseTo(point[1], 12);
    }
    expect(state.zoom).toBeGreaterThan(1.5);
  });

  it('resets to 1× and no pan, eased', () => {
    const zoomed = settle(
      zoomBy(INITIAL_ZOOM, 2.5, keeping(INITIAL_ZOOM, { x: 0.2, y: 0.2 }), BOUNDS),
    );
    const reset = resetZoom(zoomed);
    expect(reset).toEqual({ ...zoomed, targetZoom: 1, targetPan: NO_PAN });
    expect(settle(reset)).toEqual(INITIAL_ZOOM);
  });

  it('says when the zoom stands at either end, by where it is going', () => {
    expect(zoomLimits(INITIAL_ZOOM)).toEqual({ atMin: true, atMax: false });
    const middle = zoomBy(INITIAL_ZOOM, 2, centre(INITIAL_ZOOM), BOUNDS);
    expect(zoomLimits(middle)).toEqual({ atMin: false, atMax: false });
    const top = zoomBy(middle, 4, centre(middle), BOUNDS);
    expect(zoomLimits(top)).toEqual({ atMin: false, atMax: true });
    // Still at 1× on screen, but going to 3×: + is already spent.
    expect(top.zoom).toBe(1);
  });
});
