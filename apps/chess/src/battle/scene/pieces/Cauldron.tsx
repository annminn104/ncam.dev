import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Mesh } from 'three';
import { sectMaterials } from '../materials';
import type { TreasureProps } from '.';
import { CAULDRON_PILL_Y, cauldronKit } from './kits';
import { randomPhase } from './phase';

/** Rook, the Nine-Dragon Cauldron: a ding on three legs, an elixir pill rising off its qi. */
export function Cauldron({ side }: TreasureProps) {
  const k = cauldronKit();
  const m = sectMaterials(side);
  const pill = useRef<Mesh>(null);
  const [phase] = useState(randomPhase);
  useFrame(({ clock }) => {
    const p = pill.current;
    if (!p) return;
    const t = clock.elapsedTime + phase;
    // Bobs down into the mouth from its rest height, never above the ears' tops.
    p.position.y = CAULDRON_PILL_Y - 0.015 * (1 + Math.sin(t * 2.2));
    p.rotation.y = t * 1.5;
  });
  return (
    <group>
      <mesh geometry={k.trim} material={m.trim} castShadow />
      <mesh geometry={k.jade} material={m.body} castShadow />
      <mesh geometry={k.pool} material={m.qi} />
      <mesh ref={pill} geometry={k.pill} material={m.qi} position-y={CAULDRON_PILL_Y} />
    </group>
  );
}
