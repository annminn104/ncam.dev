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

    cards.forEach((card, i) => {
      ScrollTrigger.create({
        trigger: card,
        start: 'top 60%',
        onEnter: () => setActiveIndex(i),
        onLeaveBack: () => setActiveIndex(Math.max(0, i - 1)),
      });
    });

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
      return;
    }

    // Card i recedes while card i+1 arrives.
    cards.forEach((card, i) => {
      const next = cards[i + 1];
      if (!next) return;
      gsap.to(card, {
        scale: 0.94,
        opacity: 0.35,
        filter: 'blur(2px)',
        ease: 'none',
        scrollTrigger: { trigger: next, start: 'top 90%', end: 'top 35%', scrub: true },
      });
    });
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
