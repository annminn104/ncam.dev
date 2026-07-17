import { createContext, useContext } from 'react';

/**
 * Whether entrance animations are active. Disabled on the SSR / hydrate path so
 * the server renders visible, static markup (no framer-motion `opacity:0`),
 * which keeps first paint readable and makes SSR markup identical to hydration.
 * The CSR mount path leaves it enabled so animations play.
 */
export const MotionEnabledContext = createContext(true);

export const useMotionEnabled = () => useContext(MotionEnabledContext);

export interface FadeUpProps {
  initial: { opacity: number; y: number };
  whileInView: { opacity: number; y: number };
  viewport: { once: boolean; margin: string };
  transition: { duration: number; delay: number; ease: 'easeOut' };
}

export const fadeUp = (delay: number): FadeUpProps => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-100px' },
  transition: { duration: 0.6, delay, ease: 'easeOut' },
});

/**
 * Returns a fade-up prop factory. Call once per component (hook), then spread
 * the result: `const fade = useFade(); ... <motion.div {...fade(0.1)} />`.
 * When motion is disabled it returns empty props → the element renders visible.
 */
export function useFade(): (delay?: number) => FadeUpProps | Record<string, never> {
  const enabled = useContext(MotionEnabledContext);
  return (delay = 0) => (enabled ? fadeUp(delay) : {});
}
