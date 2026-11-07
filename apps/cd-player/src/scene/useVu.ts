import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { Color } from 'three';
import type { SceneBridge } from '../bridge';
import type { PlayerModel } from './model';
import { VU_OFF, VU_SEGMENTS, vuFrame } from './vu';
import { vuMaterialsFor } from './vu-materials';

/**
 * Lights the VU strip in the frame loop (`vuFrame`): paced while a track plays, still while it is
 * paused (the clock stops), off when nothing is loaded, a disc is changing or nothing has played
 * yet, calm under reduced motion.
 */
export function useVu(model: PlayerModel, bridge: SceneBridge, colours: readonly string[]): void {
  const segments = useMemo(() => vuMaterialsFor(model), [model]);
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const palette = useMemo(
    () => ({ on: colours.map((hex) => new Color(hex)), off: new Color(VU_OFF) }),
    [colours],
  );
  // Null until a track plays: a scene that boots on a paused track keeps the strip dark.
  const clock = useRef<number | null>(null);
  const levels = useRef(new Array<number>(VU_SEGMENTS).fill(0));
  useFrame(() => {
    const { status } = bridge.getView();
    clock.current = vuFrame(clock.current, status, performance.now(), reduced, levels.current);
    for (let i = 0; i < segments.length; i++) {
      segments[i].color.copy(palette.off).lerp(palette.on[i], levels.current[i]);
    }
  });
}
