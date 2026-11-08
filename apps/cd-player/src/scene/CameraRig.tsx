import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { CameraChannel, CameraCommand } from '../camera-channel';
import type { ModelId } from '../models';
import { frameForViewport, nearFor, panKeeping, type CanvasPoint } from './framing';
import { createGestures, gestureFactor, type Gesture, type PointerAt } from './gestures';
import { interaction, releaseLost } from './interaction';
import { dragOrbit, INITIAL_ORBIT, resetOrbit, stepOrbit, type Orbit } from './orbit';
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

/** What the camera reads of Safari's GestureEvent, which TypeScript's DOM types do not have. */
interface SafariGesture {
  /** The fingers' spread since gesturestart, which is 1. */
  scale: number;
  clientX: number;
  clientY: number;
}

/** A pointer event as the gestures read it. */
const pointerAt = (event: PointerEvent): PointerAt => ({
  id: event.pointerId,
  type: event.pointerType,
  x: event.clientX,
  y: event.clientY,
});

/**
 * Holds the hero framing for the canvas's size, every frame (resizes included), turned by a drag
 * and zoomed (zoom.ts): by the wheel, a pinch and the shell's buttons and keys (`channel`), toward
 * the point under the pointer. A double-click, a double tap or the channel's reset recentres the
 * orbit and the zoom; another model comes on show at 1×. Its pointer gestures are gestures.ts's.
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

    // A drag orbits, two taps recentre, two touches pinch (gestures.ts).
    const gestures = createGestures();
    const apply = (gesture: Gesture) => {
      if (gesture.kind === 'orbit') {
        const { dx, dy } = gesture;
        // By the lens on screen now, so a zoomed view swings at 1×'s rate.
        orbit.current = dragOrbit(orbit.current, dx, dy, element.clientWidth, zoom.current.zoom);
      } else if (gesture.kind === 'pinch') {
        const { from, to } = gesture;
        zoomAt(gesture.factor, pointAt(from.x, from.y), pointAt(to.x, to.y));
      } else if (gesture.kind === 'recentre') {
        recentre();
      }
    };
    const down = (event: PointerEvent) => {
      // R3F's handler for this event runs after this one, and sets it again for a key or the knob.
      interaction.controlActive = false;
      const began = gestures.down(pointerAt(event), event.button, event.isPrimary);
      if (began === 'pinch') interaction.pinches += 1;
      interaction.pinching = gestures.pinching;
    };
    // A control turns by itself; and a mouse that moves with no button down has lost its release
    // (a native menu took it, say), so it is not dragging any more.
    const move = (event: PointerEvent) =>
      apply(gestures.move(pointerAt(event), interaction.controlActive || releaseLost(event)));
    const up = (event: PointerEvent) => {
      apply(gestures.up(pointerAt(event), event.timeStamp, interaction.controlActive));
      interaction.pinching = gestures.pinching;
    };
    const cancel = (event: PointerEvent) => {
      gestures.cancel(event.pointerId);
      interaction.pinching = gestures.pinching;
    };
    const reset = () => {
      if (!interaction.controlActive) recentre();
    };
    // Safari's trackpad pinch is a run of gesture events (GestureEvent), which no other browser
    // sends: its scale's steps zoom about the fingers. An iPhone's touch pinch sends them beside
    // its touches, which already pinch, so they then only keep the page from zooming. Not tried in
    // a real Safari here.
    let gestureScale: number | null = null;
    const gestureStart = (event: Event) => {
      event.preventDefault();
      gestureScale = 1;
    };
    const gestureChange = (event: Event) => {
      event.preventDefault();
      const { scale, clientX, clientY } = event as Event & SafariGesture;
      if (gestureScale !== null && !gestures.touching) {
        const point = pointAt(clientX, clientY);
        zoomAt(gestureFactor(gestureScale, scale), point, point);
      }
      gestureScale = scale;
    };
    const gestureEnd = (event: Event) => {
      event.preventDefault();
      gestureScale = null;
    };
    // A plain wheel scrolls the page where it can that way (a phone's, a narrow window's); Ctrl or
    // ⌘ with the wheel, and a trackpad's pinch (a wheel with ctrlKey), always zoom. A stream of
    // events keeps its first choice (wheel.ts wheelStep), and a sideways one is the page's.
    let stream: WheelStream | null = null;
    const wheel = (event: WheelEvent) => {
      // A pinch Safari is already sending as gesture events never zooms twice.
      if (gestureScale !== null && event.ctrlKey) {
        event.preventDefault();
        return;
      }
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
    const safari = 'GestureEvent' in window;
    if (safari) {
      element.addEventListener('gesturestart', gestureStart);
      element.addEventListener('gesturechange', gestureChange);
      element.addEventListener('gestureend', gestureEnd);
    }
    return () => {
      offCommand();
      element.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      element.removeEventListener('dblclick', reset);
      element.removeEventListener('wheel', wheel);
      if (safari) {
        element.removeEventListener('gesturestart', gestureStart);
        element.removeEventListener('gesturechange', gestureChange);
        element.removeEventListener('gestureend', gestureEnd);
      }
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
