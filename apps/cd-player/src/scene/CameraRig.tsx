import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { frameForViewport } from './framing';
import { interaction } from './interaction';
import { dragOrbit, INITIAL_ORBIT, resetOrbit, stepOrbit, type Orbit } from './orbit';

/**
 * Holds the hero framing for the canvas's size, every frame (resizes included), turned by a drag;
 * a double-click recentres it.
 */
export function CameraRig() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const orbit = useRef<Orbit>(INITIAL_ORBIT);

  useEffect(() => {
    const element = gl.domElement;
    let drag: { id: number; x: number; y: number } | null = null;
    const down = (event: PointerEvent) => {
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (interaction.controlActive) {
        drag = null;
        return;
      }
      orbit.current = dragOrbit(
        orbit.current,
        event.clientX - drag.x,
        event.clientY - drag.y,
        element.clientWidth,
      );
      drag.x = event.clientX;
      drag.y = event.clientY;
    };
    const up = (event: PointerEvent) => {
      if (drag?.id === event.pointerId) drag = null;
    };
    const reset = () => {
      orbit.current = resetOrbit(orbit.current);
    };
    element.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    element.addEventListener('dblclick', reset);
    return () => {
      element.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      element.removeEventListener('dblclick', reset);
    };
  }, [gl]);

  useFrame((_, dt) => {
    orbit.current = stepOrbit(orbit.current, dt);
    const frame = frameForViewport(size.width, size.height, orbit.current.yaw, orbit.current.pitch);
    camera.position.set(...frame.position);
    camera.lookAt(...frame.target);
  });
  return null;
}
