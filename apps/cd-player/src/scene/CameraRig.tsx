import { useFrame, useThree } from '@react-three/fiber';
import { frameForViewport } from './framing';

/** Holds the hero framing for the canvas's size, every frame (resizes included). */
export function CameraRig() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  useFrame(() => {
    const frame = frameForViewport(size.width, size.height);
    camera.position.set(...frame.position);
    camera.lookAt(...frame.target);
  });
  return null;
}
