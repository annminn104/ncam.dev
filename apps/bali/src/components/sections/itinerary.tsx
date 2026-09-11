import { MapPin } from 'lucide-react';
import { useRef } from 'react';
import { itinerary, unsplash } from '../../data/bali';
import { EASE_OUT, gsap, useGsap } from '../../lib/gsap';
import { Accent, SectionHeading } from '../ui/section-heading';

/**
 * Pinned horizontal scroll (md+): the section pins for `track.scrollWidth` px of
 * vertical scroll while each full-width day panel translates left by
 * `-100% × (days − 1)` (scrub: 1). Below md the days stack vertically with a
 * simple stagger reveal instead.
 */
export function Itinerary() {
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useGsap(({ isDesktop }) => {
    const pin = pinRef.current;
    const track = trackRef.current;
    if (!pin || !track) return;
    const panels = Array.from(track.children) as HTMLElement[];
    if (panels.length === 0) return;

    if (!isDesktop) {
      gsap.fromTo(
        panels,
        { opacity: 0, y: 48 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: EASE_OUT,
          stagger: 0.15,
          scrollTrigger: { trigger: track, start: 'top 80%', once: true },
        },
      );
      return;
    }

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: pin,
        pin: true,
        scrub: 1,
        start: 'top top',
        end: () => `+=${track.scrollWidth}`,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    });
    tl.to(panels, { xPercent: -100 * (panels.length - 1) }, 0).to(
      progressRef.current,
      { scaleX: 1 },
      0,
    );
  });

  return (
    <section id="itinerary" className="relative scroll-mt-28 bg-[#040a0c]">
      <div
        ref={pinRef}
        className="relative flex flex-col overflow-hidden py-24 md:h-screen md:min-h-[720px] md:py-0"
      >
        <div className="mx-auto w-full max-w-7xl px-6 md:pt-24">
          <SectionHeading
            eyebrow="Signature itinerary"
            title={
              <>
                Seven days, <Accent>one unhurried</Accent> line across the island
              </>
            }
            description="Scroll to move day by day. This is the Signature Bali route — every stop can be swapped, stretched or skipped."
            className="max-w-2xl"
          />
        </div>

        <div
          ref={trackRef}
          className="mt-12 flex flex-col gap-8 px-6 md:mt-0 md:min-h-0 md:flex-1 md:flex-row md:gap-0 md:px-0"
        >
          {itinerary.map((day) => (
            <article
              key={day.day}
              className="flex items-center will-change-transform md:min-w-full md:px-6"
            >
              <div className="glass mx-auto grid w-full max-w-5xl gap-8 rounded-3xl p-6 md:grid-cols-[1.1fr_1fr] md:items-center md:p-8">
                {/* Height-capped so heading + card fit inside the pinned viewport on short screens. */}
                <div className="relative aspect-[4/3] max-h-[44vh] overflow-hidden rounded-2xl">
                  <img
                    src={unsplash(day.image, 1200)}
                    alt={day.alt}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <span className="absolute left-5 top-5 rounded-full bg-tropical-lime px-4 py-1.5 font-display text-sm tracking-[0.2em] text-jungle-black">
                    DAY {String(day.day).padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-tropical-lime">
                    <MapPin size={12} aria-hidden="true" />
                    {day.location}
                  </p>
                  <h3 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-off-white md:text-4xl">
                    {day.title}
                  </h3>
                  <p className="mt-5 leading-relaxed text-soft-gray">{day.description}</p>
                  <p className="mt-8 font-display text-6xl leading-none text-off-white/10">
                    {String(day.day).padStart(2, '0')}
                    <span className="text-2xl text-off-white/10">
                      {' '}
                      / {String(itinerary.length).padStart(2, '0')}
                    </span>
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Progress (desktop) */}
        <div className="hidden px-6 pb-10 md:block">
          <div className="mx-auto h-px w-full max-w-5xl bg-white/10">
            <div ref={progressRef} className="h-full origin-left scale-x-0 bg-tropical-lime" />
          </div>
        </div>
      </div>
    </section>
  );
}
