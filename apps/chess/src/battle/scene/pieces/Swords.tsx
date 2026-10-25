import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group } from 'three';
import { sectMaterials } from '../materials';
import type { TreasureProps } from '.';
import { swordsKit } from './kits';
import { randomPhase } from './phase';

/** Queen, the Flying Sword Ring: eight jade swords orbiting a jade core, tips up like a crown. */
export function Swords({ side }: TreasureProps) {
  const k = swordsKit();
  const m = sectMaterials(side);
  const ring = useRef<Group>(null);
  const [phase] = useState(randomPhase);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.y = phase + clock.elapsedTime * 0.7;
  });
  return (
    <group>
      <mesh geometry={k.trim} material={m.trim} castShadow />
      <mesh geometry={k.jade} material={m.body} castShadow />
      <group ref={ring}>
        <mesh geometry={k.blades} material={m.body} castShadow />
        <mesh geometry={k.hilts} material={m.trim} castShadow />
        <mesh geometry={k.glow} material={m.glow} />
      </group>
    </group>
  );
}
