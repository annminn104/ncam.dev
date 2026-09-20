import { useRef, useState, type CSSProperties } from 'react';
import { experiences } from '../data/profile';
import { gsap, ScrollTrigger, useGsap } from '../lib/gsap';
import { SectionHead } from './section-head';

/**
 * Stacked-card timeline (desktop): each role card is sticky; as the next one
 * slides up, the card beneath scales down and dims. A sticky year rail on the
 * left crossfades to the active role's start year. Below 960px the cards flow
 * normally and the rail is hidden.
 */
export function Experiences() {
  const stackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useGsap(({ isDesktop }) => {
    const stack = stackRef.current;
    if (!stack) return;
    const cards = Array.from(stack.children) as HTMLElement[];

    // Derive the rail's active year from where the cards actually are, not from
    // crossing callbacks. `onEnter`/`onLeaveBack` fire once per crossing and are
    // never replayed when ScrollTrigger re-measures — and this component mounts
    // inside a client-only federated remote, so the five other remotes on the
    // home page keep mounting *after* these triggers exist and push the section
    // down by thousands of pixels. When the stack happens to sit near the top of
    // a still-short page at setup time, all four `onEnter`s fire at once and the
    // rail sticks on the last role until the reader scrolls through the section.
    // Reading the rects on every update (and every refresh) cannot desync.
    let current = -1;
    const syncActive = () => {
      const line = window.innerHeight * 0.6;
      let index = 0;
      cards.forEach((card, i) => {
        if (card.getBoundingClientRect().top <= line) index = i;
      });
      if (index === current) return;
      current = index;
      setActiveIndex(index);
    };

    ScrollTrigger.create({
      trigger: stack,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: syncActive,
      onRefresh: syncActive,
    });
    syncActive();

    // ScrollTrigger caches every start/end as an absolute scroll offset and only
    // re-measures on window resize and `load` — a document that simply grows
    // taller never triggers that. On the home page it always does: this section
    // lives in a client-only federated remote and the five others mount around
    // it whenever their chunks land, moving the stack by thousands of pixels
    // after these triggers were measured. Stale offsets leave cards blurred out
    // of turn and the year rail pinned to whichever role was "entered" against
    // the old layout.
    // The 4px threshold and the re-baseline after refreshing matter: a refresh
    // itself nudges the document height, and reacting to that would loop.
    let lastHeight = document.documentElement.scrollHeight;
    let pending = 0;
    let refreshing = false;
    const observer = new ResizeObserver(() => {
      const height = document.documentElement.scrollHeight;
      if (refreshing || Math.abs(height - lastHeight) < 4) return;
      window.clearTimeout(pending);
      pending = window.setTimeout(() => {
        refreshing = true;
        ScrollTrigger.refresh();
        lastHeight = document.documentElement.scrollHeight;
        refreshing = false;
      }, 200);
    });
    observer.observe(document.documentElement);
    const stopWatchingHeight = () => {
      window.clearTimeout(pending);
      observer.disconnect();
    };

    if (!isDesktop) {
      gsap.fromTo(
        cards,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: { trigger: stack, start: 'top 80%', once: true },
        },
      );
      return stopWatchingHeight;
    }

    // Card i recedes while card i+1 arrives. `fromTo` + `immediateRender: false`
    // pins the clean state as the explicit start instead of letting GSAP record
    // whatever the card looks like on its first render, and `invalidateOnRefresh`
    // re-reads it whenever the page grows underneath us — without both, a card
    // that first rendered mid-scrub keeps a blurred baseline it never returns from.
    cards.forEach((card, i) => {
      const next = cards[i + 1];
      if (!next) return;
      gsap.fromTo(
        card,
        { scale: 1, opacity: 1, filter: 'blur(0px)' },
        {
          scale: 0.94,
          opacity: 0.35,
          filter: 'blur(2px)',
          ease: 'none',
          immediateRender: false,
          scrollTrigger: {
            trigger: next,
            start: 'top 90%',
            end: 'top 35%',
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );
    });

    return stopWatchingHeight;
  });

  return (
    <section id="experience" className="sec xp" aria-labelledby="xp-title">
      <div className="sec__inner">
        <SectionHead
          label={`Experience · ${experiences.length} roles`}
          title={
            <span id="xp-title">
              Five years of shipping <em>interfaces</em>
            </span>
          }
          lead="From creative micro-sites to the NPay team at NAVER Vietnam. Each role is a card — scroll and they stack."
        />

        <div className="xp__layout">
          <aside className="xp__aside" aria-hidden="true">
            {experiences.map((item, i) => (
              <p
                key={item.id}
                className="xp__year"
                data-active={activeIndex === i ? '' : undefined}
              >
                {item.year}
                <small>{item.company}</small>
              </p>
            ))}
          </aside>

          <div ref={stackRef} className="xp__stack">
            {experiences.map((item, i) => (
              <article
                key={item.id}
                className="xp-card"
                style={{ '--i': i } as CSSProperties}
                aria-label={`${item.role} at ${item.company}`}
              >
                <div className="xp-card__head">
                  <div>
                    <h3 className="xp-card__company">{item.company}</h3>
                    <p className="xp-card__role">{item.role}</p>
                  </div>
                  <p className="xp-card__period">
                    {item.period}
                    {item.location ? (
                      <>
                        <br />
                        {item.location}
                      </>
                    ) : null}
                  </p>
                </div>
                {item.summary ? <p className="xp-card__summary">{item.summary}</p> : null}
                <ul className="xp-card__bullets">
                  {item.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                <dl className="xp-card__stack">
                  {item.stack.map((row) => (
                    <div key={row.title} className="xp-card__stackrow">
                      <dt>{row.title}</dt>
                      <dd>{row.keys}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
