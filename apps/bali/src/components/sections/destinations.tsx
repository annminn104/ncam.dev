import { ArrowRight, Check, MapPin } from 'lucide-react';
import { useCallback, useState } from 'react';
import { destinations, unsplash, type Destination } from '../../data/bali';
import { useRevealChildren } from '../../lib/gsap';
import { Modal } from '../ui/modal';
import { Accent, SectionHeading } from '../ui/section-heading';

export function Destinations() {
  const [active, setActive] = useState<Destination | null>(null);
  const close = useCallback(() => setActive(null), []);
  const gridRef = useRevealChildren<HTMLDivElement>();

  return (
    <section id="destinations" className="relative scroll-mt-28 py-24 md:py-32">
      <div
        aria-hidden="true"
        className="glow-lime pointer-events-none absolute -top-40 right-0 h-[32rem] w-[32rem] opacity-60"
      />
      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Destinations"
          title={
            <>
              Six corners of the island, <Accent>one story</Accent>
            </>
          }
          description="From the cultural heart of Ubud to the limestone cliffs of Nusa Penida — every destination below is somewhere our guides grew up, not somewhere they read about."
        />

        <div ref={gridRef} className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {destinations.map((destination) => (
            <button
              key={destination.id}
              type="button"
              onClick={() => setActive(destination)}
              aria-haspopup="dialog"
              className="group relative h-[520px] overflow-hidden rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tropical-lime focus-visible:ring-offset-4 focus-visible:ring-offset-jungle-black"
            >
              <img
                src={unsplash(destination.image, 900)}
                alt={destination.alt}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-cinematic group-hover:scale-110"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-jungle-black via-jungle-black/45 to-jungle-black/5 transition-opacity duration-700"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-tropical-lime/0 transition-colors duration-700 group-hover:bg-tropical-lime/10"
              />
              <div className="absolute inset-x-0 bottom-0 p-7">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-tropical-lime">
                  <MapPin size={12} aria-hidden="true" />
                  {destination.region}
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-off-white">
                  {destination.name}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-soft-gray">
                  {destination.blurb}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-off-white transition-colors group-hover:text-tropical-lime">
                  Discover
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className="transition-transform duration-500 ease-cinematic group-hover:translate-x-1.5"
                  />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Modal
        open={active !== null}
        onClose={close}
        label={active ? `${active.name} — destination details` : 'Destination details'}
        className="grid w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-glass shadow-2xl md:h-[min(88vh,760px)] md:grid-cols-2"
      >
        {active ? (
          <>
            <div className="relative h-64 md:h-full">
              <img
                src={unsplash(active.image, 1400)}
                alt={active.alt}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-glass/80 via-transparent to-transparent md:bg-linear-to-r"
              />
            </div>
            <div className="flex max-h-[70vh] flex-col overflow-y-auto p-8 md:max-h-none md:p-12">
              <p className="eyebrow">{active.region}</p>
              <h3 className="mt-4 text-4xl font-semibold tracking-tight text-off-white md:text-5xl">
                {active.name}
              </h3>
              <p className="mt-6 leading-relaxed text-soft-gray">{active.description}</p>
              <h4 className="mt-8 text-xs font-semibold uppercase tracking-[0.25em] text-off-white/70">
                Highlights
              </h4>
              <ul className="mt-4 space-y-3">
                {active.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-off-white/90">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tropical-lime/15 text-tropical-lime">
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-10">
                <a href="#booking" onClick={close} className="btn-lime">
                  Plan a trip to {active.name}
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
              </div>
            </div>
          </>
        ) : null}
      </Modal>
    </section>
  );
}
