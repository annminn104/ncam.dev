import { useRef } from 'react';
import { marqueeRows, stackCategories } from '../data/profile';
import { gsap, ScrollTrigger, useGsap } from '../lib/gsap';
import { SectionHead } from './section-head';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Three infinite marquee rows (alternating direction) whose speed reacts to
 * scroll velocity, then the stack categories as a horizontal strip. On desktop
 * the strip pins and slides sideways as you scroll (scrub), with a progress bar
 * and counter; below 960px and under reduced motion it is a native horizontal
 * scroll-snap row instead.
 */
export function TechStacks() {
  const marqueeRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const total = stackCategories.length;

  useGsap(({ isDesktop }) => {
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

    const pin = pinRef.current;
    const track = trackRef.current;
    const counter = counterRef.current;
    if (!isDesktop || !pin || !track) return;

    // GSAP drives the strip: switch the track from native scrolling to a transform.
    pin.classList.add('is-pinned');
    const distance = () => Math.max(0, track.scrollWidth - pin.clientWidth);

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: pin,
        start: 'center center',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (counter) counter.textContent = pad(Math.round(self.progress * (total - 1)) + 1);
        },
      },
    });
    tl.to(track, { x: () => -distance() }, 0);
    if (progressRef.current) tl.to(progressRef.current, { scaleX: 1 }, 0);

    return () => {
      pin.classList.remove('is-pinned');
      track.scrollLeft = 0;
    };
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
          lead="Five years across React, Next.js, Remix and Angular codebases — enterprise platforms, real-time operations, creative micro-sites. The strip below is the toolbox that came out of it: scroll to move through it."
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
        <div ref={pinRef} className="stacks__pin">
          <div className="stacks__bar" aria-hidden="true">
            <span className="stacks__counter">
              <span ref={counterRef}>01</span> / {pad(total)}
            </span>
            <span className="stacks__progress">
              <i ref={progressRef} />
            </span>
            <span className="stacks__hint">scroll →</span>
          </div>

          <div ref={trackRef} className="stacks__track" role="list" aria-label="Tech stack areas">
            {stackCategories.map((category) => (
              <article key={category.title} className="stack-card" role="listitem">
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
      </div>
    </section>
  );
}
