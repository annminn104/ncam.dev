import { useState, type RefObject } from 'react';
import { sections } from '../data/sections';
import { gsap, ScrollTrigger, useGsap } from './gsap';

export interface SectionTracker {
  /** Id of the section currently crossing the middle of the viewport. */
  active: string;
  /** Ids of every section that has been active at least once ("cached"). */
  visited: string[];
}

/**
 * The host's choreography BETWEEN modules — everything that spans more than one
 * section, so no remote has to know about its neighbours:
 *  - one ScrollTrigger per section drives the nav's active link, the manifest
 *    rail's states and a tween of the page background (`--page-bg` on `.home`)
 *    to the section's colour;
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
        onToggle: (self) => {
          if (!self.isActive) return;
          setActive(section.id);
          setVisited((prev) => (prev.includes(section.id) ? prev : [...prev, section.id]));
          gsap.to(root, {
            '--page-bg': section.bg,
            duration: 1,
            ease: 'power2.out',
            overwrite: 'auto',
          });
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

  return { active, visited };
}
