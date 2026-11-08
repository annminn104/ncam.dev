import { isDoubleTap, TAP_SLOP_PX, type Tap } from './orbit';

/**
 * The canvas's pointer gestures (src/scene/CameraRig.tsx): a drag that orbits, two taps that
 * recentre, two touches that pinch. Pure and DOM-free: the camera feeds it its pointer events and
 * does what it answers.
 */

/** A point in the page (CSS px, client coordinates). */
export interface Point {
  x: number;
  y: number;
}

/** A pointer as the gestures read it: its id and kind (PointerEvent.pointerType), and where it is. */
export interface PointerAt extends Point {
  id: number;
  type: string;
}

/** What a pointer event asks of the camera. */
export type Gesture =
  | { kind: 'none' }
  /** Turn the orbit by this drag (CSS px). */
  | { kind: 'orbit'; dx: number; dy: number }
  /** Zoom by `factor`, the point under `from` going under `to`: the fingers' midpoint, then now. */
  | { kind: 'pinch'; factor: number; from: Point; to: Point }
  /** A double tap: recentre the orbit and the zoom. */
  | { kind: 'recentre' };

export interface Gestures {
  /**
   * A pointer went down on the canvas (`button` its button, `primary` PointerEvent.isPrimary):
   * 'press' for the primary button or a lone touch, 'pinch' for a second touch, else 'none' (a
   * third touch does nothing).
   */
  down(pointer: PointerAt, button: number, primary: boolean): 'press' | 'pinch' | 'none';
  /** A pointer moved; `released`: its press is over (a key or the knob took it, a lost release). */
  move(pointer: PointerAt, released: boolean): Gesture;
  /** A pointer lifted at `at` (ms); `onControl`: its press went to a key or the knob. */
  up(pointer: PointerAt, at: number, onControl: boolean): Gesture;
  cancel(id: number): void;
  /** Two touches are pinching the canvas. */
  readonly pinching: boolean;
  /** A touch is down on the canvas. */
  readonly touching: boolean;
}

/** A press of the primary button or a lone touch, until it lifts or is lost. */
interface Press {
  id: number;
  /** Where it went down, to tell a tap from a drag. */
  start: Point;
  /** Where it was last seen: the orbit turns by the steps between. */
  last: Point;
  /** It has strayed beyond a tap's slop, so it is a drag. */
  moved: boolean;
}

/** Two touches pinching: their midpoint and how far apart they were last seen. */
interface Pinch {
  a: number;
  b: number;
  mid: Point;
  span: number;
}

const NONE: Gesture = { kind: 'none' };

export function createGestures(): Gestures {
  let press: Press | null = null;
  // The last touch that ended as a tap, for the next one to make a double tap with.
  let lastTap: Tap | null = null;
  // Every touch down on the canvas, where it was last seen: two of them pinch.
  const touches = new Map<number, Point>();
  let pinch: Pinch | null = null;
  // Touches still down from a pinch that has ended, or past the two that pinch: they neither orbit
  // nor tap.
  const spent = new Set<number>();

  const pinchOf = (a: number, b: number): Pinch => {
    const p = touches.get(a) ?? { x: 0, y: 0 };
    const q = touches.get(b) ?? p;
    return {
      a,
      b,
      mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 },
      span: Math.hypot(p.x - q.x, p.y - q.y),
    };
  };
  /** Whether a lifted pointer was a touch that pinched, or one left from a pinch. */
  const lift = (id: number): boolean => {
    if (!touches.delete(id)) return false;
    if (pinch && (id === pinch.a || id === pinch.b)) {
      pinch = null;
      for (const other of touches.keys()) spent.add(other);
      return true;
    }
    return spent.delete(id);
  };

  return {
    down({ id, type, x, y }, button, primary) {
      if (type === 'touch') {
        // A gesture's first touch: no other is down, whatever a lost end left listed.
        if (primary) {
          touches.clear();
          spent.clear();
          pinch = null;
        }
        touches.set(id, { x, y });
        if (touches.size > 1) {
          // A second touch pinches: it ends a one-finger drag and is never a tap.
          press = null;
          lastTap = null;
          if (touches.size > 2) {
            spent.add(id);
            return 'none';
          }
          const [a, b] = [...touches.keys()];
          pinch = pinchOf(a, b);
          spent.clear();
          return 'pinch';
        }
      }
      if (button !== 0) return 'none';
      press = { id, start: { x, y }, last: { x, y }, moved: false };
      return 'press';
    },
    move({ id, x, y }, released) {
      if (touches.has(id)) {
        touches.set(id, { x, y });
        if (pinch && (id === pinch.a || id === pinch.b)) {
          // The fingers spread or close round their midpoint, which carries the view with it.
          const next = pinchOf(pinch.a, pinch.b);
          const factor = pinch.span > 0 && next.span > 0 ? next.span / pinch.span : 1;
          const gesture: Gesture = { kind: 'pinch', factor, from: pinch.mid, to: next.mid };
          pinch = next;
          return gesture;
        }
      }
      if (!press || id !== press.id) return NONE;
      if (released) {
        press = null;
        lastTap = null;
        return NONE;
      }
      if (Math.hypot(x - press.start.x, y - press.start.y) > TAP_SLOP_PX) press.moved = true;
      const gesture: Gesture = { kind: 'orbit', dx: x - press.last.x, dy: y - press.last.y };
      press.last = { x, y };
      return gesture;
    },
    up({ id, type, x, y }, at, onControl) {
      if (lift(id)) return NONE;
      if (press?.id !== id) return NONE;
      const { moved } = press;
      press = null;
      // Touch has no reliable dblclick (some browsers send none): two quick taps do the same.
      if (type !== 'touch') return NONE;
      if (moved || onControl) {
        lastTap = null;
        return NONE;
      }
      const tap = { at, x, y };
      if (isDoubleTap(lastTap, tap)) {
        lastTap = null;
        return { kind: 'recentre' };
      }
      lastTap = tap;
      return NONE;
    },
    cancel(id) {
      lift(id);
      if (press?.id === id) press = null;
      lastTap = null;
    },
    get pinching() {
      return pinch !== null;
    },
    get touching() {
      return touches.size > 0;
    },
  };
}
