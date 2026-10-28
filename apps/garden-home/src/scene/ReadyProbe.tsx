import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { settledCount, useAppStore } from '../state/store';

/**
 * Once every slot settled and 3 frames rendered: sets window.__sceneReady (e2e, poster capture) and
 * calls onReady once (the shell fades the canvas in over the poster).
 */
export function ReadyProbe({ total, onReady }: { total: number; onReady: () => void }) {
  const settled = useAppStore(settledCount);
  const frames = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (settled < total || done.current) return;
    frames.current += 1;
    if (frames.current < 3) return;
    done.current = true;
    window.__sceneReady = true;
    onReady();
  });
  return null;
}
