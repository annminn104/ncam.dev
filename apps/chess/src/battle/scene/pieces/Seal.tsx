import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Mesh } from 'three';
import { sectMaterials } from '../materials';
import type { TreasureProps } from '.';
import { SEAL, sealKit } from './kits';
import { randomPhase } from './phase';

/** King, the Heaven Seal: a jade seal, its dragon knob chasing a flaming pearl in a halo. */
export function Seal({ side }: TreasureProps) {
  const k = sealKit();
  const m = sectMaterials(side);
  const flame = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const [phase] = useState(randomPhase);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    // The flame flickers down from its full height, which is the seal's top.
    flame.current?.scale.set(1, 0.94 + 0.04 * Math.sin(t * 7.3) + 0.02 * Math.sin(t * 12.1), 1);
    const s = 1 + 0.06 * Math.sin(t * 2);
    halo.current?.scale.set(s, 1, s);
  });
  return (
    <group>
      <mesh geometry={k.jade} material={m.body} castShadow />
      <mesh geometry={k.trim} material={m.trim} castShadow />
      <mesh geometry={k.pearl} material={m.qi} />
      <mesh ref={flame} geometry={k.flame} material={m.glow} position-y={SEAL.flame} />
      <mesh ref={halo} geometry={k.halo} material={m.glow} position-y={SEAL.pearl} />
    </group>
  );
}
