import { useFrame } from '@react-three/fiber';
import type { Square } from 'chess.js';
import { useRef } from 'react';
import type { Mesh, MeshBasicMaterial } from 'three';
import { squareToPosition, type Side } from '../../../game/coords';

/** A pulsing ring of qi under the king in check (`square`, the side to move's king). */
export function CheckAura({ square, side }: { square: Square | null; side: Side }) {
  const ring = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const r = ring.current;
    if (!r) return;
    // Written whole from the clock each frame.
    const pulse = Math.sin(clock.elapsedTime * 5);
    r.scale.setScalar(1 + pulse * 0.12);
    (r.material as MeshBasicMaterial).opacity = 0.55 + pulse * 0.25;
  });
  if (!square) return null;
  const [x, z] = squareToPosition(square);
  return (
    <mesh ref={ring} name="check-aura" position={[x, 0.02, z]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.36, 0.5, 48]} />
      <meshBasicMaterial
        color={side === 'w' ? '#ffd166' : '#ff3355'}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
