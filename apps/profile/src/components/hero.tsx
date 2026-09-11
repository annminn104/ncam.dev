import { useRef } from 'react';
import { profile } from '../data/profile';
import { gsap, useGsap } from '../lib/gsap';

/** Split a line into per-character spans (words stay unbreakable). SSR-deterministic. */
function Chars({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((word, wordIndex) => (
        <span key={wordIndex} className="hero__word">
          {Array.from(word).map((char, charIndex) => (
            <span key={charIndex} className="hero__char">
              {char}
            </span>
          ))}
        </span>
      ))}
    </>
  );
}

/**
 * Sticky hero. On load the name assembles character by character (each glyph
 * slots in from alternating sides — modules arriving), then the copy fades up.
 * The scroll-linked "unmount" (next section covers it while `.hero__inner`
 * scales down and blurs) is choreographed by the HOST, which owns transitions
 * between modules — see apps/portfolio/src/lib/use-section-tracker.ts.
 */
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  // First paragraph carries the thesis (left column); the rest sit under the skills.
  const [lead, ...more] = profile.summary;

  useGsap(() => {
    const section = sectionRef.current;
    if (!section) return;
    const chars = section.querySelectorAll<HTMLElement>('.hero__char');
    const intro = section.querySelectorAll<HTMLElement>('.intro');

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(
      chars,
      {
        opacity: 0,
        yPercent: 110,
        x: (i) => (i % 2 === 0 ? -48 : 48),
        skewX: (i) => (i % 2 === 0 ? 10 : -10),
      },
      {
        opacity: 1,
        yPercent: 0,
        x: 0,
        skewX: 0,
        duration: 1.2,
        stagger: { each: 0.028, from: 'start' },
      },
      0.15,
    ).fromTo(intro, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1, stagger: 0.1 }, 0.7);
  });

  return (
    <section id="top" ref={sectionRef} className="hero" aria-label="Introduction">
      <div className="hero__bg" aria-hidden="true" />
      <div className="hero__orb hero__orb--a" aria-hidden="true" />
      <div className="hero__orb hero__orb--b" aria-hidden="true" />

      <div className="hero__inner sec__inner">
        <div className="hero__eyebrow intro">
          <span>{profile.roleLine}</span>
          <span aria-hidden="true">/</span>
          <span>{profile.location}</span>
        </div>

        <h1 className="hero__name" aria-label={`${profile.displayName} — ${profile.name}`}>
          <span className="hero__line hero__line--outline" aria-hidden="true">
            <Chars text={profile.nameLines[0]} />
          </span>
          <span className="hero__line" aria-hidden="true">
            <Chars text={profile.nameLines[1]} />
          </span>
        </h1>

        <div className="hero__grid">
          <div className="intro">
            <p className="hero__role">
              {profile.role} working in <span>{profile.roleAccent}</span>.
            </p>
            <p className="hero__summary">{lead}</p>
          </div>
          <div className="intro">
            <p className="label">Skills in one line</p>
            <ul className="hero__chips">
              {profile.skillsSummary.map((skill) => (
                <li key={skill} className="chip">
                  {skill}
                </li>
              ))}
            </ul>
            {more.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="hero__more">
                {paragraph}
              </p>
            ))}
            <div className="hero__meta">
              <span className="hero__avail">{profile.status}</span>
              <a href={`mailto:${profile.email}`} className="hero__mail">
                {profile.email}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="hero__cue intro" aria-hidden="true">
        scroll
      </div>
    </section>
  );
}
