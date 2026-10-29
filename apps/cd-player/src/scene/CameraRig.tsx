import { useFrame, useThree } from '@react-three/fiber';
import { frameFor } from './framing';

/** Holds the hero framing for the canvas's aspect, every frame (resizes included). */
export function CameraRig() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  useFrame(() => {
    const frame = frameFor(size.width / Math.max(size.height, 1), size.width > 820);
    camera.position.set(...frame.position);
    camera.lookAt(...frame.target);
  });
  return null;
}
