import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { Color } from 'three';
import type { SceneBridge } from '../bridge';
import type { PlayerModel } from './model';
import { VU_COLOURS, VU_OFF, VU_SEGMENTS, vuLevels } from './vu';
import { vuMaterialsFor } from './vu-materials';

/**
 * Lights the VU strip in the frame loop: paced while a track plays, still while it is paused (the
 * clock stops), off when nothing is loaded or a disc is changing, calm under reduced motion.
 */
export function useVu(model: PlayerModel, bridge: SceneBridge): void {
  const segments = useMemo(() => vuMaterialsFor(model), [model]);
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const palette = useMemo(
    () => ({ on: VU_COLOURS.map((hex) => new Color(hex)), off: new Color(VU_OFF) }),
    [],
  );
  const clock = useRef(0);
  const levels = useRef(new Array<number>(VU_SEGMENTS).fill(0));
  useFrame(() => {
    const { status } = bridge.getView();
    if (status === 'playing') clock.current = performance.now();
    const loaded = status === 'playing' || status === 'paused';
    vuLevels(clock.current, loaded, reduced, levels.current);
    for (let i = 0; i < segments.length; i++) {
      segments[i].color.copy(palette.off).lerp(palette.on[i], levels.current[i]);
    }
  });
}
