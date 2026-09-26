import { useEffect, useState } from 'react';
import { REDUCED_MOTION_QUERY } from './capability';

/**
 * Live `prefers-reduced-motion` state, for gating CSS-only animation that
 * runs even when the WebGL holo layer itself never mounts — HoloCard's
 * hover pop is plain `transform`/`transition` on the card's wrapper, set
 * regardless of `active`, so it is not covered by supportsHolo()'s own
 * reduced-motion check (capability.ts), which only gates the three.js
 * scene. This hook is what lets that CSS pop honour the same policy.
 *
 * False on the server and until the first client effect runs — same
 * SSR-safe default as useMounted, so hydration never mismatches — so a
 * reduced-motion visitor sees at most one un-gated frame before the effect
 * settles, never an actual animation.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    setReduced(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
