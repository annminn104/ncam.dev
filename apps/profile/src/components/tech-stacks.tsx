import { useRef } from 'react';
import { marqueeRows, stackCategories } from '../data/profile';
import { gsap, ScrollTrigger, useGsap, useRevealChildren } from '../lib/gsap';
import { SectionHead } from './section-head';

/**
 * Three infinite marquee rows (alternating direction) whose speed reacts to
 * scroll velocity, then the stack categories as a responsive card grid.
 *
 * The categories used to be a pinned strip that scrolled sideways under a
 * progress bar. They are a grid now: every area is readable at a glance, the
 * section no longer pins the page, and there is no horizontal scrolling to
 * discover. Cards stagger in on scroll and, on a fine pointer, tilt toward the
 * cursor with a spotlight following it — the same idiom as the projects grid,
 * so the two sections feel like one system.
 */
export function TechStacks() {
  const marqueeRef = useRef<HTMLDivElement>(null);
  const gridRef = useRevealChildren<HTMLDivElement>({ y: 44, stagger: 0.06 });
  const total = stackCategories.length;

  useGsap(({ finePointer }) => {
    const cleanups: Array<() => void> = [];

    const group = marqueeRef.current;
    if (group) {
      const tracks = Array.from(group.querySelectorAll<HTMLElement>('.marquee__track'));
      const loops = tracks.map((track, i) => {
        const reverse = i % 2 === 1;
        return gsap.fromTo(
          track,
          { xPercent: reverse ? -50 : 0 },
          { xPercent: reverse ? 0 : -50, ease: 'none', duration: 28 + i * 6, repeat: -1 },
        );
      });
      // Scroll velocity nudges the loops faster, then they settle back.
      ScrollTrigger.create({
        onUpdate: (self) => {
          const boost = 1 + Math.min(3, Math.abs(self.getVelocity()) / 350);
          loops.forEach((loop) => {
            gsap.to(loop, {
              timeScale: boost,
              duration: 0.25,
              overwrite: true,
              onComplete: () => {
                gsap.to(loop, { timeScale: 1, duration: 1.4, ease: 'power2.out' });
              },
            });
          });
        },
      });
    }

    // Tilt + spotlight. Pointer-driven, so it is skipped on touch: `--mx/--my`
    // stay at their CSS defaults and the card keeps its plain hover treatment.
    const grid = gridRef.current;
    if (grid && finePointer) {
      for (const card of Array.from(grid.querySelectorAll<HTMLElement>('.stack-card'))) {
        gsap.set(card, { transformPerspective: 900 });
        const tiltX = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
        const tiltY = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });

        const onMove = (event: PointerEvent) => {
          const rect = card.getBoundingClientRect();
          const px = (event.clientX - rect.left) / rect.width;
          const py = (event.clientY - rect.top) / rect.height;
          card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
          card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
          // Gentler than the project cards: these sit in a denser grid.
          tiltX((0.5 - py) * 7);
          tiltY((px - 0.5) * 9);
        };
        const onLeave = () => {
          tiltX(0);
          tiltY(0);
        };
        card.addEventListener('pointermove', onMove);
        card.addEventListener('pointerleave', onLeave);
        cleanups.push(() => {
          card.removeEventListener('pointermove', onMove);
          card.removeEventListener('pointerleave', onLeave);
        });
      }
    }

    return () => cleanups.forEach((fn) => fn());
  });

  return (
    <section id="stacks" className="sec stacks" aria-labelledby="stacks-title">
      <div className="sec__inner">
        <SectionHead
          label={`Tech stacks · ${total} areas`}
          title={
            <span id="stacks-title">
              Tools I reach for, <em>and why</em>
            </span>
          }
          lead="Five years across React, Next.js, Remix and Angular codebases — enterprise platforms, real-time operations, creative micro-sites. This is the toolbox that came out of it."
        />
      </div>

      <div ref={marqueeRef} className="marquee-group" aria-hidden="true">
        {marqueeRows.map((row, i) => (
          <div key={i} className={`marquee${i % 2 === 1 ? ' marquee--outline' : ''}`}>
            <div className="marquee__track">
              {[...row, ...row].map((item, j) => (
                <span key={j} className="marquee__item">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sec__inner">
        <div ref={gridRef} className="stacks__grid" role="list" aria-label="Tech stack areas">
          {stackCategories.map((category) => (
            <article key={category.title} className="stack-card" role="listitem">
              <span className="stack-card__spot" aria-hidden="true" />
              <h3 className="stack-card__title">{category.title}</h3>
              <ul className="stack-card__chips" aria-label={category.title}>
                {category.keys.map((key) => (
                  <li key={key} className="chip">
                    {key}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
