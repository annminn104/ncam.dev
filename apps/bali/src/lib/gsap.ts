import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Both modules are import-safe in Node (they only touch window lazily), so the
// `./ssr` entry can import components that depend on this file. Registration is
// still guarded: there is nothing to scroll on the server.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
  // Mobile browsers fire resize when the address bar collapses; a full
  // ScrollTrigger refresh on every one makes pinned sections jump.
  ScrollTrigger.config({ ignoreMobileResize: true });
}

export { gsap, ScrollTrigger };

/** Cinematic ease shared by every GSAP tween in the app. */
export const EASE_OUT = 'power3.out';

/**
 * useLayoutEffect on the client so `fromTo` start states are applied before the
 * first paint (no flash of the un-animated end state); useEffect during SSR.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface MotionConditions {
  /** `(min-width: 768px)` — Tailwind's `md` breakpoint. */
  isDesktop: boolean;
}

type GsapSetup = (conditions: MotionConditions, ctx: gsap.Context) => void | (() => void);

/**
 * Run GSAP setup inside `gsap.matchMedia()`:
 *  - skipped entirely under `prefers-reduced-motion: reduce` (content stays static
 *    and visible — every animation is a `fromTo` whose end state equals the markup);
 *  - reverted and re-run when the viewport crosses the `md` breakpoint;
 *  - fully reverted on unmount, which also makes it safe under React StrictMode's
 *    mount → cleanup → mount double invocation (no orphaned ScrollTriggers, no
 *    elements left at `opacity: 0`).
 */
export function useGsap(setup: GsapSetup, deps: readonly unknown[] = []): void {
  useIsomorphicLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      {
        isDesktop: '(min-width: 768px)',
        reduceMotion: '(prefers-reduced-motion: reduce)',
      },
      (ctx) => {
        const conditions = ctx.conditions ?? {};
        if (conditions.reduceMotion) return;
        return setup({ isDesktop: Boolean(conditions.isDesktop) }, ctx);
      },
    );
    return () => mm.revert();
  }, deps);
}

export interface RevealOptions {
  /** Start offset in px (slides up into place). */
  y?: number;
  /** Delay between children, in seconds. */
  stagger?: number;
  /** ScrollTrigger start, e.g. `'top 80%'`. */
  start?: string;
}

/**
 * Stagger-reveal the DIRECT CHILDREN of the returned ref's element as it scrolls
 * into view. Targets `wrapper.children` with a single `gsap.fromTo` — the
 * StrictMode-safe pattern. Per-item ref arrays + `gsap.from` break under React's
 * double-invoked effects and leave grids invisible.
 */
export function useRevealChildren<T extends HTMLElement>(options: RevealOptions = {}) {
  const ref = useRef<T>(null);
  const { y = 48, stagger = 0.12, start = 'top 80%' } = options;

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
