import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { CameraChannel, CameraCommand } from '../camera-channel';
import type { ModelId } from '../models';
import { frameForViewport, nearFor, panKeeping, type CanvasPoint } from './framing';
import { interaction, releaseLost } from './interaction';
import {
  dragOrbit,
  INITIAL_ORBIT,
  isDoubleTap,
  resetOrbit,
  stepOrbit,
  TAP_SLOP_PX,
  type Orbit,
  type Tap,
} from './orbit';
import { SCENE_PROFILES } from './profiles';
import { scrollersOf, scrollsFirst, wheelFactor, wheelStep, type WheelStream } from './wheel';
import {
  INITIAL_ZOOM,
  resetZoom,
  stepZoom,
  ZOOM_STEP,
  zoomBy,
  zoomLimits,
  type Zoom,
} from './zoom';

/** A press of the primary button on the canvas, until it is released or lost. */
interface Press {
  id: number;
  /** Where it went down (CSS px), to tell a tap from a drag. */
  startX: number;
  startY: number;
  /** Where it was last seen: the orbit turns by the steps between. */
  x: number;
  y: number;
  /** It has strayed beyond a tap's slop, so it is a drag. */
  moved: boolean;
}

/** Two touches pinching the canvas: their midpoint and how far apart they were last seen. */
interface Pinch {
  a: number;
  b: number;
  mid: CanvasPoint;
  /** CSS px. */
  span: number;
}

/**
 * Holds the hero framing for the canvas's size, every frame (resizes included), turned by a drag
 * and zoomed (zoom.ts): by the wheel, a pinch and the shell's buttons and keys (`channel`), toward
 * the point under the pointer. A double-click, a double tap or the channel's reset recentres the
 * orbit and the zoom; another model comes on show at 1×.
 */
export function CameraRig({ model, channel }: { model: ModelId; channel: CameraChannel }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const orbit = useRef<Orbit>(INITIAL_ORBIT);
  const zoom = useRef<Zoom>(INITIAL_ZOOM);
  // The model the camera frames, whose zoom this is.
  const framed = useRef(model);

  useEffect(() => {
    const element = gl.domElement;
    // The buttons' disabled states follow where the zoom is going.
    const publish = () => channel.setLimits(zoomLimits(zoom.current));
    const pointAt = (clientX: number, clientY: number): CanvasPoint => {
      const rect = element.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: 1 - ((clientY - rect.top) / rect.height) * 2,
      };
    };
    /**
     * Zooms by `factor`, the point of the aim's plane under `from` going under `to` (the same point
     * but for a pinch). Inputs move the targets, so it reckons from where the view is going.
     */
    const zoomAt = (factor: number, from: CanvasPoint, to: CanvasPoint) => {
      const state = zoom.current;
      const { targetYaw, targetPitch } = orbit.current;
      const aspect = element.clientWidth / Math.max(element.clientHeight, 1);
      const keep = (next: number) =>
        panKeeping(
          aspect,
          targetYaw,
          targetPitch,
          framed.current,
          state.targetZoom,
          state.targetPan,
          from,
          to,
          next,
        );
      zoom.current = zoomBy(state, factor, keep, SCENE_PROFILES[framed.current].frame);
      publish();
    };
    const recentre = () => {
      orbit.current = resetOrbit(orbit.current);
      zoom.current = resetZoom(zoom.current);
      publish();
    };
    // The buttons and the keys: a step toward the view's centre, which keeps the pan.
    const command = (asked: CameraCommand) => {
      if (asked === 'reset') {
        recentre();
        return;
      }
      const { targetPan } = zoom.current;
      const factor = asked === 'zoom-in' ? ZOOM_STEP : 1 / ZOOM_STEP;
      const frame = SCENE_PROFILES[framed.current].frame;
      zoom.current = zoomBy(zoom.current, factor, () => targetPan, frame);
      publish();
    };

    let press: Press | null = null;
    // The last touch that ended as a tap, for the next one to make a double tap with.
    let lastTap: Tap | null = null;
    // Every touch down on the canvas, where it was last seen (CSS px): two of them pinch.
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: Pinch | null = null;
    // Touches still down from a pinch that has ended, or past the two that pinch: they neither
    // orbit nor tap.
    const spent = new Set<number>();
    const pinchOf = (a: number, b: number): Pinch => {
      const p = touches.get(a) ?? { x: 0, y: 0 };
      const q = touches.get(b) ?? p;
      return {
        a,
        b,
        mid: pointAt((p.x + q.x) / 2, (p.y + q.y) / 2),
        span: Math.hypot(p.x - q.x, p.y - q.y),
      };
    };
    /** Whether a lifted pointer was a touch that pinched, or one left from a pinch. */
    const lift = (id: number): boolean => {
      if (!touches.delete(id)) return false;
      if (pinch && (id === pinch.a || id === pinch.b)) {
        pinch = null;
        interaction.pinching = false;
        for (const other of touches.keys()) spent.add(other);
        return true;
      }
      return spent.delete(id);
    };

    const down = (event: PointerEvent) => {
      // R3F's handler for this event runs after this one, and sets it again for a key or the knob.
      interaction.controlActive = false;
      const { pointerId: id, clientX: x, clientY: y } = event;
      if (event.pointerType === 'touch') {
        // The first touch of a gesture: no other touch is down, whatever a lost end left listed.
        if (event.isPrimary) {
          touches.clear();
          spent.clear();
          pinch = null;
          interaction.pinching = false;
        }
        touches.set(id, { x, y });
        if (touches.size > 1) {
          // A second touch pinches: it ends a one-finger drag and is never a tap. A third does
          // nothing.
          if (touches.size === 2) {
            const [a, b] = [...touches.keys()];
            pinch = pinchOf(a, b);
            spent.clear();
            interaction.pinching = true;
            interaction.pinches += 1;
          } else spent.add(id);
          press = null;
          lastTap = null;
          return;
        }
      }
      if (event.button !== 0) return;
      press = { id, startX: x, startY: y, x, y, moved: false };
    };
    const move = (event: PointerEvent) => {
      const { pointerId: id, clientX: x, clientY: y } = event;
      if (touches.has(id)) {
        touches.set(id, { x, y });
        if (pinch && (id === pinch.a || id === pinch.b)) {
          // The fingers spread or close round their midpoint, which carries the view with it.
          const next = pinchOf(pinch.a, pinch.b);
          if (pinch.span > 0 && next.span > 0) zoomAt(next.span / pinch.span, pinch.mid, next.mid);
          pinch = next;
          return;
        }
      }
      if (!press || id !== press.id) return;
      // A control turns by itself; and a mouse that moves with no button down has lost its release
      // (a native menu took it, say), so it is not dragging any more.
      if (interaction.controlActive || releaseLost(event)) {
        press = null;
        lastTap = null;
        return;
      }
      if (Math.hypot(x - press.startX, y - press.startY) > TAP_SLOP_PX) press.moved = true;
      orbit.current = dragOrbit(orbit.current, x - press.x, y - press.y, element.clientWidth);
      press.x = x;
      press.y = y;
    };
    const up = (event: PointerEvent) => {
      if (lift(event.pointerId)) return;
      if (press?.id !== event.pointerId) return;
      const { moved } = press;
      press = null;
      // Touch has no reliable dblclick (some browsers send none): two quick taps do the same.
      if (event.pointerType !== 'touch') return;
      if (moved || interaction.controlActive) {
        lastTap = null;
        return;
      }
      const tap = { at: event.timeStamp, x: event.clientX, y: event.clientY };
      if (isDoubleTap(lastTap, tap)) {
        recentre();
        lastTap = null;
      } else {
        lastTap = tap;
      }
    };
    const cancel = (event: PointerEvent) => {
      lift(event.pointerId);
      if (press?.id === event.pointerId) press = null;
      lastTap = null;
    };
    const reset = () => {
      if (!interaction.controlActive) recentre();
    };
    // A plain wheel scrolls the page where it can that way (a phone's, a narrow window's); Ctrl or
    // ⌘ with the wheel, and a trackpad's pinch (a wheel with ctrlKey), always zoom. A stream of
    // events keeps its first choice (wheel.ts wheelStep), and a sideways one is the page's.
    let stream: WheelStream | null = null;
    const wheel = (event: WheelEvent) => {
      const { deltaX, deltaY, timeStamp: at } = event;
      const zoomKey = event.ctrlKey || event.metaKey;
      const step = wheelStep(stream, { deltaX, deltaY, zoomKey, at }, () =>
        scrollsFirst(scrollersOf(element), deltaY),
      );
      stream = step.stream;
      if (!step.zooms) return;
      event.preventDefault();
      const point = pointAt(event.clientX, event.clientY);
      zoomAt(wheelFactor(deltaY, event.deltaMode), point, point);
    };
    publish();
    const offCommand = channel.onCommand(command);
    element.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    element.addEventListener('dblclick', reset);
    // Not passive: a wheel that zooms keeps the page from scrolling or zooming with it.
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      offCommand();
      element.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      element.removeEventListener('dblclick', reset);
      element.removeEventListener('wheel', wheel);
      interaction.pinching = false;
      // The next scene starts at 1×.
      channel.setLimits(zoomLimits(INITIAL_ZOOM));
    };
  }, [gl, channel]);

  useFrame((_, dt) => {
    if (framed.current !== model) {
      // Another model on show: it comes in its hero framing, at 1×.
      framed.current = model;
      zoom.current = INITIAL_ZOOM;
      channel.setLimits(zoomLimits(INITIAL_ZOOM));
    }
    orbit.current = stepOrbit(orbit.current, dt);
    zoom.current = stepZoom(zoom.current, dt);
    const { yaw, pitch } = orbit.current;
    const frame = frameForViewport(size.width, size.height, yaw, pitch, model, zoom.current.pan);
    camera.position.set(...frame.position);
    const near = nearFor(model);
    const lens = zoom.current.zoom;
    if (camera.near !== near || camera.zoom !== lens) {
      camera.near = near;
      camera.zoom = lens;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(...frame.target);
  });
  return null;
}
