import { Check } from 'lucide-react';
import { useRef } from 'react';
import { experiences, unsplash, type Experience } from '../../data/bali';
import { EASE_OUT, gsap, useGsap } from '../../lib/gsap';
import { cn } from '../../lib/utils';
import { Accent, SectionHeading } from '../ui/section-heading';

export function Experiences() {
  return (
    <section id="experiences" className="scroll-mt-28 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Experiences"
          title={
            <>
              Not sights. <Accent>Rituals</Accent>, reefs and recipes.
            </>
          }
          description="The island rewards depth over distance. These three threads run through every itinerary we design — dial each one up or down."
        />

        <div className="mt-20 space-y-24 md:space-y-36">
          {experiences.map((experience, i) => (
            <ExperienceBlock key={experience.id} experience={experience} reversed={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ExperienceBlock({ experience, reversed }: { experience: Experience; reversed: boolean }) {
  const blockRef = useRef<HTMLDivElement>(null);

  useGsap(() => {
    const block = blockRef.current;
    if (!block) return;
    const frame = block.querySelector<HTMLElement>('[data-reveal-frame]');
    const image = block.querySelector<HTMLElement>('[data-reveal-image]');
    const copy = block.querySelector<HTMLElement>('[data-reveal-copy]');
    if (!frame || !image || !copy) return;

    const scrollTrigger = { trigger: block, start: 'top 72%', once: true };

    // Image: clip-path wipe (from the outer edge) + settle from a slight zoom.
    gsap.fromTo(
      frame,
      { clipPath: reversed ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' },
      { clipPath: 'inset(0 0% 0 0%)', duration: 1.3, ease: 'power4.out', scrollTrigger },
    );
    gsap.fromTo(
      image,
      { scale: 1.18 },
      { scale: 1, duration: 1.6, ease: 'power3.out', scrollTrigger },
    );
    // Copy: slide in from the side opposite the image.
    gsap.fromTo(
      copy,
      { opacity: 0, x: reversed ? -64 : 64 },
      { opacity: 1, x: 0, duration: 1, ease: EASE_OUT, delay: 0.15, scrollTrigger },
    );
  }, [reversed]);

  return (
    <div ref={blockRef} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <div
        data-reveal-frame
        className={cn(
          'relative aspect-[4/5] overflow-hidden rounded-3xl',
          reversed && 'md:order-2',
        )}
      >
        <img
          data-reveal-image
          src={unsplash(experience.image, 1200)}
          alt={experience.alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover will-change-transform"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-jungle-black/60 via-transparent to-transparent"
        />
        <span className="absolute bottom-6 left-6 rounded-full border border-white/15 bg-jungle-black/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-off-white backdrop-blur-md">
          {experience.eyebrow}
        </span>
      </div>

      <div data-reveal-copy className={cn('will-change-transform', reversed && 'md:order-1')}>
        <p className="eyebrow">{experience.eyebrow}</p>
        <h3 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-off-white md:text-5xl">
          {experience.title} <Accent>{experience.accent}</Accent>
        </h3>
        <p className="mt-6 leading-relaxed text-soft-gray">{experience.description}</p>
        <ul className="mt-8 space-y-3">
          {experience.points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm text-off-white/90">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tropical-lime/15 text-tropical-lime">
                <Check size={12} strokeWidth={3} aria-hidden="true" />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
