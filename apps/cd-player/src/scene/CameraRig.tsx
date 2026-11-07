import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { ModelId } from '../models';
import { frameForViewport, nearFor } from './framing';
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

/**
 * Holds the hero framing for the canvas's size, every frame (resizes included), turned by a drag;
 * a double-click, or a double tap, recentres it.
 */
export function CameraRig({ model }: { model: ModelId }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const orbit = useRef<Orbit>(INITIAL_ORBIT);

  useEffect(() => {
    const element = gl.domElement;
    let press: Press | null = null;
    // The last touch that ended as a tap, for the next one to make a double tap with.
    let lastTap: Tap | null = null;
    const down = (event: PointerEvent) => {
      // R3F's handler for this event runs after this one, and sets it again for a key or the knob.
      interaction.controlActive = false;
      if (event.button !== 0) return;
      const { pointerId: id, clientX: x, clientY: y } = event;
      press = { id, startX: x, startY: y, x, y, moved: false };
    };
    const move = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.id) return;
      // A control turns by itself; and a mouse that moves with no button down has lost its release
      // (a native menu took it, say), so it is not dragging any more.
      if (interaction.controlActive || releaseLost(event)) {
        press = null;
        lastTap = null;
        return;
      }
      const { clientX: x, clientY: y } = event;
      if (Math.hypot(x - press.startX, y - press.startY) > TAP_SLOP_PX) press.moved = true;
      orbit.current = dragOrbit(orbit.current, x - press.x, y - press.y, element.clientWidth);
      press.x = x;
      press.y = y;
    };
    const up = (event: PointerEvent) => {
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
        orbit.current = resetOrbit(orbit.current);
        lastTap = null;
      } else {
        lastTap = tap;
      }
    };
    const cancel = (event: PointerEvent) => {
      if (press?.id === event.pointerId) press = null;
      lastTap = null;
    };
    const reset = () => {
      if (!interaction.controlActive) orbit.current = resetOrbit(orbit.current);
    };
    element.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    element.addEventListener('dblclick', reset);
    return () => {
      element.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      element.removeEventListener('dblclick', reset);
    };
  }, [gl]);

  useFrame((_, dt) => {
    orbit.current = stepOrbit(orbit.current, dt);
    const frame = frameForViewport(
      size.width,
      size.height,
      orbit.current.yaw,
      orbit.current.pitch,
      model,
    );
    camera.position.set(...frame.position);
    const near = nearFor(model);
    if (camera.near !== near) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(...frame.target);
  });
  return null;
}
