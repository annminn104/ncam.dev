import { describe, expect, it } from 'vitest';
import { createGestures, gestureFactor } from './gestures';
import { DOUBLE_TAP_MS } from './orbit';

const touch = (id: number, x: number, y: number) => ({ id, type: 'touch', x, y });
const mouse = (x: number, y: number) => ({ id: 1, type: 'mouse', x, y });
const NONE = { kind: 'none' };

/** Two fingers down on the canvas, 100 px apart round (150, 100): a pinch. */
function pinched() {
  const gestures = createGestures();
  gestures.down(touch(1, 100, 100), 0, true);
  gestures.down(touch(2, 200, 100), 0, false);
  return gestures;
}

describe('gestures: one finger', () => {
  it('orbits by a drag, step by step, and a drag is no tap', () => {
    const gestures = createGestures();
    expect(gestures.down(touch(1, 100, 100), 0, true)).toBe('press');
    expect(gestures.move(touch(1, 130, 90), false)).toEqual({ kind: 'orbit', dx: 30, dy: -10 });
    expect(gestures.move(touch(1, 140, 95), false)).toEqual({ kind: 'orbit', dx: 10, dy: 5 });
    expect(gestures.up(touch(1, 140, 95), 300, false)).toEqual(NONE);
    gestures.down(touch(2, 140, 95), 0, true);
    expect(gestures.up(touch(2, 140, 95), 400, false)).toEqual(NONE);
  });

  it('recentres on two quick taps near each other', () => {
    const gestures = createGestures();
    gestures.down(touch(1, 100, 100), 0, true);
    expect(gestures.up(touch(1, 102, 101), 1000, false)).toEqual(NONE);
    gestures.down(touch(2, 110, 104), 0, true);
    expect(gestures.up(touch(2, 110, 104), 1000 + DOUBLE_TAP_MS, false)).toEqual({
      kind: 'recentre',
    });
    // The pair is spent: a third tap starts another.
    gestures.down(touch(3, 110, 104), 0, true);
    expect(gestures.up(touch(3, 110, 104), 1100 + DOUBLE_TAP_MS, false)).toEqual(NONE);
  });

  it('neither orbits nor taps for a press a key or the knob took', () => {
    const gestures = createGestures();
    gestures.down(touch(1, 100, 100), 0, true);
    // The control took it (or a mouse lost its release): the drag is over.
    expect(gestures.move(touch(1, 150, 100), true)).toEqual(NONE);
    expect(gestures.move(touch(1, 160, 100), false)).toEqual(NONE);
    // A tap on a control is not the first of a double tap.
    gestures.down(touch(2, 100, 100), 0, true);
    expect(gestures.up(touch(2, 100, 100), 0, true)).toEqual(NONE);
    gestures.down(touch(3, 100, 100), 0, true);
    expect(gestures.up(touch(3, 100, 100), 100, false)).toEqual(NONE);
  });

  it('drags a mouse by its primary button alone, and leaves its double-click to the browser', () => {
    const gestures = createGestures();
    expect(gestures.down(mouse(10, 10), 2, true)).toBe('none');
    expect(gestures.move(mouse(20, 10), false)).toEqual(NONE);
    expect(gestures.down(mouse(10, 10), 0, true)).toBe('press');
    expect(gestures.move(mouse(20, 10), false)).toEqual({ kind: 'orbit', dx: 10, dy: 0 });
    expect(gestures.up(mouse(20, 10), 0, false)).toEqual(NONE);
    gestures.down(mouse(20, 10), 0, true);
    expect(gestures.up(mouse(20, 10), 100, false)).toEqual(NONE);
  });
});

describe('gestures: a pinch', () => {
  it('begins with a second finger, which ends the first one’s orbit', () => {
    const gestures = createGestures();
    gestures.down(touch(1, 100, 100), 0, true);
    expect(gestures.move(touch(1, 110, 100), false)).toMatchObject({ kind: 'orbit' });
    expect(gestures.down(touch(2, 200, 100), 0, false)).toBe('pinch');
    expect(gestures.pinching).toBe(true);
    // The first finger's moves pinch now: 90 px apart round (155, 100), then 120 round (140, 100).
    expect(gestures.move(touch(1, 80, 100), false)).toEqual({
      kind: 'pinch',
      factor: 120 / 90,
      from: { x: 155, y: 100 },
      to: { x: 140, y: 100 },
    });
  });

  it('zooms by the fingers’ spread and carries the view with their midpoint', () => {
    const gestures = pinched();
    expect(gestures.move(touch(2, 300, 100), false)).toEqual({
      kind: 'pinch',
      factor: 2,
      from: { x: 150, y: 100 },
      to: { x: 200, y: 100 },
    });
    // Both fingers move 50 px down, one after the other: the midpoint pans, and the spread comes
    // back to where it was, the two steps' factors making no zoom between them.
    const first = gestures.move(touch(1, 100, 150), false);
    const second = gestures.move(touch(2, 300, 150), false);
    expect(first).toMatchObject({ from: { x: 200, y: 100 }, to: { x: 200, y: 125 } });
    expect(second).toMatchObject({ from: { x: 200, y: 125 }, to: { x: 200, y: 150 } });
    const factor = (gesture: typeof first) => (gesture.kind === 'pinch' ? gesture.factor : NaN);
    expect(factor(first) * factor(second)).toBeCloseTo(1, 12);
  });

  it('ends whichever finger lifts first, and the other then neither orbits nor taps', () => {
    for (const first of [1, 2]) {
      const gestures = pinched();
      expect(gestures.up(touch(first, 150, 100), 100, false), `${first} first`).toEqual(NONE);
      expect(gestures.pinching).toBe(false);
      const other = first === 1 ? 2 : 1;
      expect(gestures.move(touch(other, 150, 150), false)).toEqual(NONE);
      expect(gestures.up(touch(other, 150, 150), 120, false)).toEqual(NONE);
      expect(gestures.touching).toBe(false);
    }
  });

  it('ignores a third finger, and pinches on with the first two', () => {
    const gestures = pinched();
    expect(gestures.down(touch(3, 150, 300), 0, false)).toBe('none');
    expect(gestures.move(touch(3, 160, 320), false)).toEqual(NONE);
    expect(gestures.move(touch(2, 300, 100), false)).toMatchObject({ kind: 'pinch', factor: 2 });
    expect(gestures.up(touch(3, 160, 320), 100, false)).toEqual(NONE);
    expect(gestures.pinching).toBe(true);
    // A pinch's finger lifting ends it; a third still down then would neither orbit nor tap.
    gestures.down(touch(4, 150, 300), 0, false);
    gestures.up(touch(1, 100, 100), 200, false);
    expect(gestures.pinching).toBe(false);
    expect(gestures.move(touch(4, 170, 300), false)).toEqual(NONE);
    expect(gestures.up(touch(4, 170, 300), 250, false)).toEqual(NONE);
  });

  it('pinches again when a finger comes back down beside one left from the last', () => {
    const gestures = pinched();
    gestures.up(touch(2, 200, 100), 100, false);
    // Finger 1 is still down, spent; a new finger 200 px away makes a new pinch with it.
    expect(gestures.down(touch(3, 300, 100), 0, false)).toBe('pinch');
    expect(gestures.pinching).toBe(true);
    expect(gestures.move(touch(3, 500, 100), false)).toMatchObject({ kind: 'pinch', factor: 2 });
    gestures.up(touch(1, 100, 100), 200, false);
    expect(gestures.pinching).toBe(false);
    expect(gestures.up(touch(3, 500, 100), 250, false)).toEqual(NONE);
  });

  it('ends on a pointercancel, and a cancelled press never counts toward a double tap', () => {
    const gestures = pinched();
    gestures.cancel(1);
    expect(gestures.pinching).toBe(false);
    expect(gestures.up(touch(2, 200, 100), 50, false)).toEqual(NONE);
    // A tap, then a press that is cancelled, then a tap: the cancel broke the pair.
    gestures.down(touch(4, 100, 100), 0, true);
    gestures.up(touch(4, 100, 100), 100, false);
    gestures.down(touch(5, 100, 100), 0, true);
    gestures.cancel(5);
    gestures.down(touch(6, 100, 100), 0, true);
    expect(gestures.up(touch(6, 100, 100), 200, false)).toEqual(NONE);
  });

  it('never counts toward a double tap: a tap, a quick pinch, a tap does not recentre', () => {
    const gestures = createGestures();
    gestures.down(touch(1, 100, 100), 0, true);
    gestures.up(touch(1, 100, 100), 0, false);
    gestures.down(touch(2, 100, 100), 0, true);
    gestures.down(touch(3, 120, 100), 0, false);
    // Neither of the pinch's fingers lifting is a tap.
    expect(gestures.up(touch(2, 100, 100), 50, false)).toEqual(NONE);
    expect(gestures.up(touch(3, 120, 100), 60, false)).toEqual(NONE);
    gestures.down(touch(4, 100, 100), 0, true);
    expect(gestures.up(touch(4, 100, 100), 100, false)).toEqual(NONE);
    // That last tap may start a pair of its own.
    gestures.down(touch(5, 100, 100), 0, true);
    expect(gestures.up(touch(5, 100, 100), 200, false)).toEqual({ kind: 'recentre' });
  });

  it('starts afresh at a gesture’s first touch, whatever a lost end left listed', () => {
    const gestures = createGestures();
    // This touch's end never arrives.
    gestures.down(touch(1, 100, 100), 0, true);
    expect(gestures.down(touch(2, 300, 300), 0, true)).toBe('press');
    expect(gestures.pinching).toBe(false);
    expect(gestures.move(touch(2, 320, 300), false)).toEqual({ kind: 'orbit', dx: 20, dy: 0 });
  });
});

describe('gestureFactor: Safari’s trackpad pinch', () => {
  it('zooms by the ratio of successive scales, which start from 1 at gesturestart', () => {
    expect(gestureFactor(1, 1.2)).toBeCloseTo(1.2, 12);
    expect(gestureFactor(1.2, 1.5)).toBeCloseTo(1.25, 12);
    expect(gestureFactor(1.5, 0.75)).toBeCloseTo(0.5, 12);
    // The steps multiply to the gesture's whole scale, as the fingers spread.
    expect(gestureFactor(1, 1.2) * gestureFactor(1.2, 1.5)).toBeCloseTo(1.5, 12);
  });

  it('zooms nowhere for a scale that is not a positive number', () => {
    expect(gestureFactor(1, 0)).toBe(1);
    expect(gestureFactor(0, 1.2)).toBe(1);
    expect(gestureFactor(1, Number.NaN)).toBe(1);
    expect(gestureFactor(1, -2)).toBe(1);
  });
});
