import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { createFrameGate } from './frameGate';

/** With frameloop="demand": renders at most `fps` per second and never while the page is hidden. */
export function FrameLimiter({ fps }: { fps: number }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const gate = createFrameGate(fps);
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!document.hidden && gate(now)) invalidate();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps, invalidate]);
  return null;
}
