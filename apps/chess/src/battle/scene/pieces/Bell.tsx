import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group } from 'three';
import { sectMaterials } from '../materials';
import type { TreasureProps } from '.';
import { BELL_PIVOT_Y, bellKit } from './kits';
import { randomPhase } from './phase';

/** Radians the bell swings from its loop: at rest, and ringing while its knight jumps. */
const SWAY_IDLE = 0.04;
const SWAY_JUMP = 0.35;

/** Knight, the Spirit Bell: it sways on its loop, and rings while the knight makes its L-jump. */
export function Bell({ side, jumping }: TreasureProps) {
  const k = bellKit();
  const m = sectMaterials(side);
  const swing = useRef<Group>(null);
  // The angle lives here and is written to the group whole each frame (see phase.ts).
  const angle = useRef(0);
  const [phase] = useState(randomPhase);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + phase;
    const target = jumping ? Math.sin(t * 18) * SWAY_JUMP : Math.sin(t * 1.3) * SWAY_IDLE;
    angle.current += (target - angle.current) * (1 - Math.exp(-14 * delta));
    if (swing.current) swing.current.rotation.z = angle.current;
  });
  return (
    <group position-y={BELL_PIVOT_Y}>
      <group ref={swing}>
        <group position-y={-BELL_PIVOT_Y}>
          <mesh geometry={k.jade} material={m.body} castShadow />
          <mesh geometry={k.trim} material={m.trim} castShadow />
          <mesh geometry={k.glow} material={m.glow} />
        </group>
      </group>
    </group>
  );
}
