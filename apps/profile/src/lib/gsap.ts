import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Import-safe in Node (the modules only touch window lazily), so route files
// that render on the server can import components that depend on this file.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
}

export { gsap, ScrollTrigger };

export const EASE_OUT = 'power3.out';

/** useLayoutEffect on the client (apply `fromTo` start states before paint), useEffect during SSR. */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface MotionConditions {
  /** `(min-width: 960px)` — where the home page switches to its desktop layouts. */
  isDesktop: boolean;
  /** `(pointer: fine)` — hover/magnetic effects only make sense with a mouse. */
  finePointer: boolean;
}

type GsapSetup = (conditions: MotionConditions, ctx: gsap.Context) => void | (() => void);

/**
 * Run GSAP setup inside `gsap.matchMedia()`:
 *  - skipped entirely under `prefers-reduced-motion: reduce` (markup is the final state);
 *  - reverted and re-run when the viewport crosses the desktop breakpoint;
 *  - fully reverted on unmount and on route change, which also makes it safe under
 *    React StrictMode's double-invoked effects.
 */
export function useGsap(setup: GsapSetup, deps: readonly unknown[] = []): void {
  useIsomorphicLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      {
        isDesktop: '(min-width: 960px)',
        finePointer: '(pointer: fine)',
        reduceMotion: '(prefers-reduced-motion: reduce)',
      },
      (ctx) => {
        const conditions = ctx.conditions ?? {};
        if (conditions.reduceMotion) return;
        return setup(
          {
            isDesktop: Boolean(conditions.isDesktop),
            finePointer: Boolean(conditions.finePointer),
          },
          ctx,
        );
      },
    );
    return () => mm.revert();
  }, deps);
}

export interface RevealOptions {
  y?: number;
  stagger?: number;
  start?: string;
}

/**
 * Stagger-reveal the DIRECT CHILDREN of the returned ref's element as it scrolls
 * into view — one `gsap.fromTo(wrapper.children, …)`, the StrictMode-safe pattern.
 */
export function useRevealChildren<T extends HTMLElement>(options: RevealOptions = {}) {
  const ref = useRef<T>(null);
  const { y = 40, stagger = 0.1, start = 'top 82%' } = options;

  useGsap(() => {
    const wrapper = ref.current;
    if (!wrapper || wrapper.children.length === 0) return;
    gsap.fromTo(
      wrapper.children,
      { opacity: 0, y },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: EASE_OUT,
        stagger,
        scrollTrigger: { trigger: wrapper, start, once: true },
      },
    );
  }, [y, stagger, start]);

  return ref;
}

/**
 * Magnetic hover: the element eases toward the pointer while hovered and snaps
 * back on leave. Only active with a fine pointer and without reduced motion.
 */
export function useMagnetic(ref: RefObject<HTMLElement | null>, strength = 0.35): void {
  useGsap(
    ({ finePointer }) => {
      const el = ref.current;
      if (!el || !finePointer) return;
      const toX = gsap.quickTo(el, 'x', { duration: 0.5, ease: EASE_OUT });
      const toY = gsap.quickTo(el, 'y', { duration: 0.5, ease: EASE_OUT });
      const onMove = (event: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        toX((event.clientX - rect.left - rect.width / 2) * strength);
        toY((event.clientY - rect.top - rect.height / 2) * strength);
      };
      const onLeave = () => {
        toX(0);
        toY(0);
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      return () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      };
    },
    [strength],
  );
}
