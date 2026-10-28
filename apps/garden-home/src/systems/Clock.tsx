import { useFrame } from '@react-three/fiber';
import { globalUniforms } from './uniforms';

export function ClockSystem() {
  useFrame(({ clock }) => {
    globalUniforms.uTime.value = clock.elapsedTime;
  });
  return null;
}
