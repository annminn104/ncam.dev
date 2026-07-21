import { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

const SLIDES = [{ label: 'WATER WAVE' }, { label: 'GRIDWAVE' }, { label: 'LIGHT TUNNEL' }];

const ACCENT = '#F598F2';

interface HeroProps {
  activeIndex: number;
  onSlideChange: (i: number) => void;
}

/** Apply IntersectionObserver-based reveal to a container's .reveal-up / .reveal-right children. */
function useReveal(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = el.querySelectorAll<HTMLElement>('.reveal-up, .reveal-right');
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 },
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [ref]);
}

export function Hero({ activeIndex, onSlideChange }: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  useReveal(sectionRef);

  const isSlide0 = activeIndex === 0;
  const dotColor = isSlide0 ? ACCENT : '#ffffff';
  const dotShadow = isSlide0 ? `0 0 8px 3px ${ACCENT}88` : '0 0 8px 3px rgba(255,255,255,0.5)';
  const accentColor = isSlide0 ? ACCENT : '#ffffff';

  return (
    <main
      ref={sectionRef}
      className="
        relative z-[2] flex h-screen flex-col justify-end items-end
        gap-[150px] pt-[190px] px-[15px]
        md-tablet:gap-[100px] md-tablet:pt-[150px] md-tablet:px-[18px]
        mobile:items-start mobile:gap-[72px] mobile:pt-[140px] mobile:px-[18px]
      "
      aria-label="Hero section"
    >
      {/* ── Section 1: Switcher + Availability ────────────────────── */}
      <div className="flex w-full max-w-[1340px] items-end gap-8 mobile:flex-col mobile:gap-7">
        {/* Left: video switcher */}
        <div className="flex flex-[4] flex-col gap-3" role="group" aria-label="Background scenes">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.label}
              type="button"
              onClick={() => onSlideChange(i)}
              aria-pressed={i === activeIndex}
              aria-label={`Switch to ${slide.label}`}
              className={cn(
                'role-link text-left text-white transition-opacity duration-300',
                i === activeIndex ? 'opacity-100' : 'opacity-55 hover:opacity-75',
              )}
            >
              <span className="text-[8px] leading-3 tracking-[-0.08px] font-medium uppercase text-white/60">
                0{i + 1}
              </span>
              <span className="ml-1 text-xs leading-4 tracking-[-0.12px] font-medium uppercase">
                / {slide.label}
              </span>
            </button>
          ))}
        </div>

        {/* Right: availability */}
        <div
          className="flex flex-1 items-center gap-2.5 justify-end mobile:justify-start"
          role="status"
          aria-label="Availability status"
        >
          <span
            className="inline-block h-[7px] w-[7px] flex-shrink-0 rounded-full"
            style={{
              backgroundColor: dotColor,
              boxShadow: dotShadow,
              animation: 'dotPulse 1.6s ease-in-out infinite',
            }}
            aria-hidden="true"
          />
          <span className="text-xs leading-4 tracking-[-0.12px] font-medium uppercase text-white/80">
            Available for work
          </span>
        </div>
      </div>

      {/* ── Section 2: Name + CTA ──────────────────────────────────── */}
      <div
        className="
          flex w-full max-w-[1340px] items-end pb-[60px] gap-[60px]
          md-tablet:gap-7 md-tablet:pb-[52px]
          mobile:flex-col mobile:items-start mobile:gap-8 mobile:pb-11
        "
      >
        {/* Left: giant name */}
        <div className="flex flex-[2] items-end">
          <h1
            className="
              reveal-up
              text-[200px] font-medium uppercase leading-[81%] tracking-[-6px] text-white
              md-tablet:text-[129.6px] md-tablet:leading-[113.4px] md-tablet:tracking-[-7.7px]
              mobile:text-[clamp(68px,21vw,80px)] mobile:leading-[96px] mobile:tracking-[-4.8px]
            "
            style={{ animationDelay: '0s' }}
          >
            Viktor
            <span style={{ color: accentColor, transition: 'color 0.6s ease' }}>.</span>
          </h1>
        </div>

        {/* Right: paragraph + CTA */}
        <div
          className="
            flex flex-1 flex-col gap-8 pl-[50px]
            md-tablet:pl-6
            mobile:pl-0 mobile:max-w-[420px]
          "
        >
          <p
            className="reveal-right text-base leading-6 tracking-[-0.16px] font-medium text-white/75"
            style={{ animationDelay: '0s' }}
          >
            I craft bold brands and modern websites with purpose — design-led, pixel-perfect, built
            to last. Every project is a chance to push what's possible.
          </p>

          <a
            href="#contact"
            className="cta-btn reveal-right inline-flex w-fit items-center border border-white/50 px-7 py-3.5 text-sm leading-5 tracking-[-0.14px] font-medium lowercase text-white transition-colors duration-300"
            style={{ animationDelay: '0.08s' }}
            aria-label="Start a project with Viktor"
          >
            <span className="cta-btn-label relative z-[1] transition-colors duration-300">
              start a project
            </span>
          </a>
        </div>
      </div>
    </main>
  );
}
