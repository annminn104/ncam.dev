import { useEffect, useRef, useState, type RefObject } from 'react';
import { sections } from '../data/sections';
import { gsap, ScrollTrigger, useGsap } from './gsap';
import { useTheme } from './theme';

export interface SectionTracker {
  /** Id of the section currently crossing the middle of the viewport. */
  active: string;
  /** Ids of every section that has been active at least once ("cached"). */
  visited: string[];
}

/**
 * The host's choreography BETWEEN modules — everything that spans more than one
 * section, so no remote has to know about its neighbours:
 *  - one ScrollTrigger per section drives the nav's active link and the manifest
 *    rail's states;
 *  - the page background (`--page-bg` on `.home`) tweens to the active section's
 *    colour for the current theme;
 *  - the hero "unmount": as the second section slides over the (sticky) hero,
 *    the hero content scales down, dims and blurs.
 *
 * Sections arrive asynchronously (federated modules), so pass `ready` once they
 * are all mounted (or failed): the effect re-runs and measures the final DOM.
 */
export function useSectionTracker(
  rootRef: RefObject<HTMLElement | null>,
  ready: boolean,
): SectionTracker {
  const [active, setActive] = useState(sections[0].id);
  const [visited, setVisited] = useState<string[]>([sections[0].id]);

  const theme = useTheme();

  useGsap(() => {
    const root = rootRef.current;
    if (!root) return;

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (!el) return;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 55%',
        end: 'bottom 55%',
        // State only. The background tween it used to do inline now lives in the
        // effect below, so the colour has a single owner and this callback needs
        // to know nothing about the theme.
        onToggle: (self) => {
          if (!self.isActive) return;
          setActive(section.id);
          setVisited((prev) => (prev.includes(section.id) ? prev : [...prev, section.id]));
        },
      });
    });

    const heroInner = root.querySelector<HTMLElement>('.hero__inner');
    const second = sections[1] ? document.getElementById(sections[1].id) : null;
    if (heroInner && second) {
      gsap.to(heroInner, {
        scale: 0.9,
        opacity: 0,
        filter: 'blur(12px)',
        ease: 'none',
        scrollTrigger: { trigger: second, start: 'top bottom', end: 'top 12%', scrub: true },
      });
    }

    // Modules mounted after the initial measurement — re-measure everything.
    ScrollTrigger.refresh();
  }, [ready]);

  /**
   * The page background, in one place: it is a function of (active section,
   * theme), so it is derived from state in an effect rather than written from
   * inside a ScrollTrigger callback. That is also what keeps this hook free of
   * refs mutated during render — `active` and `theme` are ordinary reactive
   * values, and `previousActive` is only ever touched in the commit phase.
   *
   * Tweening matters because the value is written as an INLINE style, which
   * outranks `.home { --page-bg: var(--bg) }`: without re-running on `theme` the
   * page would keep the old theme's background until the next section scrolled
   * past. Under `prefers-reduced-motion: reduce` we write nothing at all —
   * `useGsap` skips too, so no inline value exists and the stylesheet's
   * `var(--bg)` follows the theme on its own.
   */
  const previousActive = useRef(active);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const section = sections.find((item) => item.id === active);
    const scrolled = previousActive.current !== active;
    previousActive.current = active;
    if (!section) return;
    gsap.to(root, {
      '--page-bg': section.bg[theme],
      // Scrolling into a section is a slow wash; flipping the theme should feel
      // like pressing a switch.
      duration: scrolled ? 1 : 0.4,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }, [active, theme, rootRef]);

  return { active, visited };
}
