import { useRef } from 'react';
import { sections } from '../../data/sections';
import { gsap, useGsap } from '../../lib/gsap';

const BRAND = 'ncam';

export function HomeNav({ active }: { active: string }) {
  const progressRef = useRef<HTMLSpanElement>(null);

  // Reading progress: scrubbed across the whole page.
  useGsap(() => {
    if (!progressRef.current) return;
    gsap.fromTo(
      progressRef.current,
      { scaleX: 0 },
      { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.4 } },
    );
  });

  return (
    <header className="hnav">
      <span ref={progressRef} className="hnav__progress" aria-hidden="true" />
      <div className="hnav__inner">
        <a href="#top" className="hnav__brand" aria-label={`${BRAND}.dev — back to top`}>
          <span className="hnav__dot" aria-hidden="true" />
          {BRAND}.dev
        </a>
        <nav aria-label="Sections">
          <ul className="hnav__links">
            {sections
              .filter((section) => section.id !== 'top')
              .map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="hnav__link"
                    data-active={active === section.id ? '' : undefined}
                    aria-current={active === section.id ? 'location' : undefined}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
