import { ArrowRight, ChevronDown } from 'lucide-react';
import { useRef } from 'react';
import { hero } from '../../data/bali';
import { gsap, useGsap } from '../../lib/gsap';

/**
 * Pinned, scroll-scrubbed 3-layer parallax. Layers 1 + 2 rise at different
 * speeds, layer 3 (foreground foliage) sinks, the giant "BALI" wordmark behind
 * layer 3 slides down and fades, then the real hero copy fades up in its place.
 */
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const backRef = useRef<HTMLImageElement>(null);
  const midRef = useRef<HTMLImageElement>(null);
  const frontRef = useRef<HTMLImageElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGsap(() => {
    const section = sectionRef.current;
    if (!section) return;

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=160%',
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      },
    });

    tl.to(backRef.current, { yPercent: -14, scale: 1.2 }, 0)
      .to(midRef.current, { yPercent: -34, scale: 1.08 }, 0)
      .to(frontRef.current, { yPercent: 30, scale: 1.12 }, 0)
      .to(wordmarkRef.current, { yPercent: 80, autoAlpha: 0, duration: 0.55 }, 0)
      .to(hintRef.current, { autoAlpha: 0, duration: 0.25 }, 0)
      // opacity only (not autoAlpha): the <h1> stays in the accessibility tree.
      .to(contentRef.current, { opacity: 1, y: 0, duration: 0.45 }, 0.5);
  });

  return (
    <section
      id="home"
      ref={sectionRef}
      aria-label="Bali Adventure"
      className="relative h-screen min-h-[640px] w-full overflow-hidden bg-jungle-black"
    >
      {/* Layer 1 — back */}
      <img
        ref={backRef}
        src={hero.layers.back}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 z-[1] h-full w-full object-cover object-bottom will-change-transform"
      />
      {/* Layer 2 — mid */}
      <img
        ref={midRef}
        src={hero.layers.mid}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 z-[2] h-full w-full object-cover object-bottom will-change-transform"
      />

      {/* Giant wordmark — behind the front layer */}
      <div
        ref={wordmarkRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center will-change-transform"
      >
        <span className="font-display text-[clamp(7rem,32vw,28rem)] leading-none tracking-[0.05em] text-off-white [text-shadow:0_0_90px_rgba(196,213,42,0.28)]">
          {hero.wordmark}
        </span>
      </div>

      {/* Layer 3 — front foliage */}
      <img
        ref={frontRef}
        src={hero.layers.front}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 z-[4] h-full w-full object-cover object-bottom will-change-transform"
      />

      {/* Cinematic vignette + fade into the page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[5] bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(5,11,13,0.55)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-2/5 bg-linear-to-t from-jungle-black via-jungle-black/60 to-transparent"
      />

      {/* Scroll hint */}
      <div
        ref={hintRef}
        aria-hidden="true"
        className="absolute inset-x-0 bottom-8 z-[6] flex flex-col items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-off-white/70"
      >
        <span>{hero.scrollHint}</span>
        <ChevronDown size={18} className="scroll-hint text-tropical-lime" />
      </div>

      {/* Revealed hero copy — hidden inline so SSR + hydrate match; GSAP fades it up. */}
      <div
        ref={contentRef}
        data-hero-content
        style={{ opacity: 0, transform: 'translateY(64px)' }}
        className="absolute inset-0 z-[7] flex flex-col items-center justify-center px-6 text-center will-change-transform"
      >
        <p className="eyebrow">{hero.eyebrow}</p>
        <h1 className="mt-6 font-display text-[clamp(3.25rem,10vw,9rem)] leading-[0.92] tracking-[0.04em] text-off-white">
          {hero.title[0]}{' '}
          <span className="text-tropical-lime [text-shadow:0_0_50px_rgba(196,213,42,0.45)]">
            {hero.title[1]}
          </span>
        </h1>
        <p className="mt-7 max-w-2xl text-base leading-relaxed text-soft-gray md:text-lg">
          {hero.description}
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <a href={hero.primaryCta.href} className="btn-lime min-w-[13rem]">
            {hero.primaryCta.label}
            <ArrowRight size={18} aria-hidden="true" />
          </a>
          <a href={hero.secondaryCta.href} className="btn-outline min-w-[13rem]">
            {hero.secondaryCta.label}
          </a>
        </div>
      </div>
    </section>
  );
}
