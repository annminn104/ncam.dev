import { Quote, Star } from 'lucide-react';
import { testimonials } from '../../data/bali';
import { useRevealChildren } from '../../lib/gsap';
import { Accent, SectionHeading } from '../ui/section-heading';

export function Testimonials() {
  const gridRef = useRevealChildren<HTMLDivElement>({ y: 40, stagger: 0.1 });

  return (
    <section id="testimonials" className="relative scroll-mt-28 py-24 md:py-32">
      <div
        aria-hidden="true"
        className="glow-lime pointer-events-none absolute -left-40 top-20 h-[30rem] w-[30rem] opacity-50"
      />
      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeading
          align="center"
          eyebrow="Guest stories"
          title={
            <>
              Rated 4.9 by people who <Accent>came back</Accent> changed
            </>
          }
          description="Every review below is from a guest who travelled with us in the last eighteen months."
        />

        <div ref={gridRef} className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((item) => (
            <figure
              key={item.id}
              className="glass flex h-full flex-col rounded-3xl bg-white/[0.03] p-7 transition-colors duration-500 hover:border-tropical-lime/35"
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-1" aria-label={`${item.rating} out of 5 stars`}>
                  {Array.from({ length: item.rating }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className="text-tropical-lime"
                      fill="currentColor"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <Quote size={22} className="text-tropical-lime/40" aria-hidden="true" />
              </div>
              <blockquote className="mt-6 flex-1 text-[15px] leading-relaxed text-off-white/90">
                “{item.quote}”
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-4 border-t border-white/10 pt-6">
                {/* facearea crop keeps the portrait centred on the face at 96px. */}
                <img
                  src={`https://images.unsplash.com/photo-${item.avatar}?auto=format&fit=facearea&facepad=2.5&w=96&h=96&q=80`}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-tropical-lime/30"
                />
                <div>
                  <p className="font-semibold text-off-white">{item.name}</p>
                  <p className="text-xs text-soft-gray">
                    {item.origin} · {item.trip}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
