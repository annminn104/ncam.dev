import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Mesh } from 'three';
import { sectMaterials } from '../materials';
import type { TreasureProps } from '.';
import { pearlKit } from './kits';
import { randomPhase } from './phase';

/** Pawn, the Spirit Pearl: a jade pearl in a lotus, a thread of qi circling it. */
export function Pearl({ side }: TreasureProps) {
  const k = pearlKit();
  const m = sectMaterials(side);
  const qi = useRef<Mesh>(null);
  const [phase] = useState(randomPhase);
  useFrame(({ clock }) => {
    if (qi.current) qi.current.rotation.y = phase + clock.elapsedTime * 0.8;
  });
  return (
    <group>
      <mesh geometry={k.trim} material={m.trim} castShadow />
      <mesh geometry={k.jade} material={m.body} castShadow />
      <mesh ref={qi} geometry={k.qi} material={m.glow} />
    </group>
  );
}
