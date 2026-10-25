import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { settledCount, useAppStore } from '../state/store';

/** Sets window.__sceneReady once every slot settled and 3 frames rendered (e2e + poster). */
export function ReadyProbe({ total }: { total: number }) {
  const settled = useAppStore(settledCount);
  const frames = useRef(0);
  useFrame(() => {
    if (settled < total || window.__sceneReady) return;
    frames.current += 1;
    if (frames.current >= 3) window.__sceneReady = true;
  });
  return null;
}
