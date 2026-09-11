import { ArrowRight, CalendarDays, Check, MapPin, Sparkles } from 'lucide-react';
import { packages } from '../../data/bali';
import { useRevealChildren } from '../../lib/gsap';
import { cn } from '../../lib/utils';
import { Accent, SectionHeading } from '../ui/section-heading';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function Packages() {
  // Stagger the cards via the wrapper's children (StrictMode-safe fromTo).
  const gridRef = useRevealChildren<HTMLDivElement>({ y: 56, stagger: 0.15 });

  return (
    <section id="packages" className="relative scroll-mt-28 py-24 md:py-32">
      <div
        aria-hidden="true"
        className="glow-lime pointer-events-none absolute left-1/2 top-1/2 h-[40rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 opacity-50"
      />
      <div className="relative mx-auto max-w-7xl px-6">
        <SectionHeading
          align="center"
          eyebrow="Packages"
          title={
            <>
              Three ways to <Accent>disappear</Accent> into Bali
            </>
          }
          description="Every package is a starting point, not a script. Swap a temple for a surf lesson, add a night on Nusa Lembongan — pricing is transparent and per person."
        />

        <div ref={gridRef} className="mt-16 grid items-center gap-6 lg:grid-cols-3">
          {packages.map((pkg) => (
            <article
              key={pkg.id}
              className={cn(
                'glass relative flex h-full flex-col rounded-3xl p-8 transition-colors duration-500',
                pkg.popular
                  ? 'border-tropical-lime/70 bg-[#0a1519] shadow-lime-lg lg:-my-6 lg:scale-[1.04] lg:p-10'
                  : 'hover:border-white/20',
              )}
            >
              {pkg.popular ? (
                <span className="absolute -top-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-tropical-lime px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-jungle-black">
                  <Sparkles size={12} aria-hidden="true" />
                  Most popular
                </span>
              ) : null}

              <h3 className="text-2xl font-semibold tracking-tight text-off-white">{pkg.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-soft-gray">{pkg.summary}</p>

              <div className="mt-7 flex items-end gap-2">
                <span
                  className={cn(
                    'font-display text-5xl leading-none tracking-wide',
                    pkg.popular ? 'text-tropical-lime' : 'text-off-white',
                  )}
                >
                  {priceFormatter.format(pkg.price)}
                </span>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-soft-gray/80">
                {pkg.priceNote}
              </p>

              <dl className="mt-7 grid gap-3 border-y border-white/10 py-5 text-sm">
                <div className="flex items-center gap-3">
                  <dt className="sr-only">Duration</dt>
                  <CalendarDays
                    size={16}
                    className="shrink-0 text-tropical-lime"
                    aria-hidden="true"
                  />
                  <dd className="text-off-white/90">{pkg.duration}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <dt className="sr-only">Locations</dt>
                  <MapPin size={16} className="shrink-0 text-tropical-lime" aria-hidden="true" />
                  <dd className="text-off-white/90">{pkg.locations}</dd>
                </div>
              </dl>

              <ul className="mt-6 space-y-3">
                {pkg.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-soft-gray">
                    <Check
                      size={16}
                      strokeWidth={2.5}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-tropical-lime"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <a
                  href="#booking"
                  className={cn('w-full', pkg.popular ? 'btn-lime' : 'btn-outline')}
                >
                  Reserve {pkg.name}
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
