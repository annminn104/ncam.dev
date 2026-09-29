import type { CSSProperties } from 'react';
import { profile } from '../data/profile';

/**
 * Split a line into per-character spans (words stay unbreakable). SSR-deterministic.
 * Each glyph carries its place in the whole name (`--i`, from `start`) and the side
 * it slots in from (`--side`), which the entrance in profile.css reads.
 */
function Chars({ text, start }: { text: string; start: number }) {
  let index = start;
  return (
    <>
      {text.split(' ').map((word, wordIndex) => (
        <span key={wordIndex} className="hero__word">
          {Array.from(word).map((char, charIndex) => {
            const i = index++;
            return (
              <span
                key={charIndex}
                className="hero__char"
                style={{ '--i': i, '--side': i % 2 === 0 ? -1 : 1 } as CSSProperties}
              >
                {char}
              </span>
            );
          })}
        </span>
      ))}
    </>
  );
}

/** `--n`: a block's place in the copy's fade-up (see profile.css). */
function order(n: number): CSSProperties {
  return { '--n': n } as CSSProperties;
}

/**
 * Sticky hero. On load the name assembles character by character (each glyph
 * slots in from alternating sides — modules arriving) while the copy fades up:
 * CSS keyframes from the first paint (profile.css), so neither waits for
 * hydration. The scroll-linked "unmount" (next section covers it while
 * `.hero__inner` scales down and blurs) is choreographed by the HOST, which owns
 * transitions between modules — see apps/portfolio/src/lib/use-section-tracker.ts.
 */
export function Hero() {
  // First paragraph carries the thesis (left column); the rest sit under the skills.
  const [lead, ...more] = profile.summary;
  const [first, second] = profile.nameLines;

  return (
    <section id="top" className="hero" aria-label="Introduction">
      <div className="hero__bg" aria-hidden="true" />
      <div className="hero__orb hero__orb--a" aria-hidden="true" />
      <div className="hero__orb hero__orb--b" aria-hidden="true" />

      <div className="hero__inner sec__inner">
        <div className="hero__eyebrow intro" style={order(0)}>
          <span>{profile.roleLine}</span>
          <span aria-hidden="true">/</span>
          <span>{profile.location}</span>
        </div>

        <h1 className="hero__name" aria-label={`${profile.displayName} — ${profile.name}`}>
          <span className="hero__line hero__line--outline" aria-hidden="true">
            <Chars text={first} start={0} />
          </span>
          <span className="hero__line" aria-hidden="true">
            <Chars text={second} start={Array.from(first.replaceAll(' ', '')).length} />
          </span>
        </h1>

        <div className="hero__grid">
          <div className="intro" style={order(1)}>
            <p className="hero__role">
              {profile.role} working in <span>{profile.roleAccent}</span>.
            </p>
            <p className="hero__summary">{lead}</p>
          </div>
          <div className="intro" style={order(2)}>
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

      <div className="hero__cue intro" style={order(3)} aria-hidden="true">
        scroll
      </div>
    </section>
  );
}
