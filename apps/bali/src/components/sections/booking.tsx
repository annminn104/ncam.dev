import { CalendarDays, Check, Mail, MapPin, Phone, Send, Users } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { booking, brand, destinations, unsplash } from '../../data/bali';
import { useRevealChildren } from '../../lib/gsap';
import { Accent, SectionHeading } from '../ui/section-heading';

interface RequestSummary {
  destination: string;
  dates: string;
  guests: string;
  name: string;
  email: string;
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** `<input type="date">` yields YYYY-MM-DD; parse as local midnight, not UTC. */
function formatDate(value: string): string {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00`)) : '';
}

function formatRange(from: string, to: string): string {
  const start = formatDate(from);
  const end = formatDate(to);
  return start && end ? `${start} → ${end}` : start || end || 'Flexible';
}

export function Booking() {
  const wrapRef = useRevealChildren<HTMLDivElement>({ y: 48, stagger: 0.15 });
  const formRef = useRef<HTMLFormElement>(null);
  const [summary, setSummary] = useState<RequestSummary | null>(null);

  // Demo request: no backend — the submitted details are echoed back as a
  // confirmation so the flow is complete end-to-end in the browser.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? '').trim();
    setSummary({
      destination: read('destination'),
      dates: formatRange(read('from'), read('to')),
      guests: read('guests'),
      name: read('name'),
      email: read('email'),
    });
  };

  const reset = () => {
    setSummary(null);
    formRef.current?.reset();
  };

  return (
    <section id="booking" className="relative scroll-mt-28 py-24 md:py-32">
      <div
        aria-hidden="true"
        className="glow-lime pointer-events-none absolute -bottom-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 opacity-50"
      />
      <div
        ref={wrapRef}
        className="relative mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_1.1fr]"
      >
        {/* Copy + contact */}
        <div>
          <SectionHeading
            eyebrow={booking.eyebrow}
            title={
              <>
                {booking.title} <Accent>{booking.accent}</Accent>
              </>
            }
            description={booking.description}
          />

          <div className="relative mt-10 aspect-[16/10] overflow-hidden rounded-3xl">
            <img
              src={unsplash(booking.image, 1200)}
              alt={booking.imageAlt}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-t from-jungle-black/80 via-jungle-black/20 to-transparent"
            />
            <ul className="absolute inset-x-0 bottom-0 grid gap-3 p-6 text-sm text-off-white/90 sm:grid-cols-2">
              <li className="flex items-center gap-3">
                <Mail size={16} className="shrink-0 text-tropical-lime" aria-hidden="true" />
                <a href={`mailto:${brand.email}`} className="hover:text-tropical-lime">
                  {brand.email}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={16} className="shrink-0 text-tropical-lime" aria-hidden="true" />
                <a href={brand.phoneHref} className="hover:text-tropical-lime">
                  {brand.phone}
                </a>
              </li>
              <li className="flex items-center gap-3 sm:col-span-2">
                <MapPin size={16} className="shrink-0 text-tropical-lime" aria-hidden="true" />
                <span>{brand.address}</span>
              </li>
            </ul>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-soft-gray/70">{brand.hours}</p>
        </div>

        {/* Form */}
        <div className="glass relative rounded-3xl p-6 sm:p-10">
          {summary ? (
            <div className="flex h-full flex-col justify-center py-6 text-center" role="status">
              <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-tropical-lime text-jungle-black shadow-lime">
                <Check size={30} strokeWidth={3} aria-hidden="true" />
              </span>
              <h3 className="mt-8 text-3xl font-semibold tracking-tight text-off-white">
                {booking.successTitle}
              </h3>
              <p className="mx-auto mt-3 max-w-md text-soft-gray">{booking.successBody}</p>
              <dl className="mx-auto mt-8 grid w-full max-w-md gap-3 rounded-2xl border border-white/10 bg-jungle-black/40 p-5 text-left text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-soft-gray">Destination</dt>
                  <dd className="text-off-white">{summary.destination}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-soft-gray">Dates</dt>
                  <dd className="text-off-white">{summary.dates}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-soft-gray">Guests</dt>
                  <dd className="text-off-white">{summary.guests}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-soft-gray">Reply to</dt>
                  <dd className="truncate text-off-white">
                    {summary.name} · {summary.email}
                  </dd>
                </div>
              </dl>
              <button type="button" onClick={reset} className="btn-outline mx-auto mt-8">
                Plan another trip
              </button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
              <h3 className="text-2xl font-semibold tracking-tight text-off-white sm:col-span-2">
                Request a private itinerary
              </h3>

              <label className="grid gap-2 text-sm sm:col-span-2">
                <span className="inline-flex items-center gap-2 text-soft-gray">
                  <MapPin size={14} className="text-tropical-lime" aria-hidden="true" />
                  Destination
                </span>
                <select name="destination" required defaultValue="" className="field">
                  <option value="" disabled>
                    Choose a region
                  </option>
                  {destinations.map((destination) => (
                    <option key={destination.id} value={destination.name}>
                      {destination.name} — {destination.region}
                    </option>
                  ))}
                  <option value="The whole island">The whole island</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                <span className="inline-flex items-center gap-2 text-soft-gray">
                  <CalendarDays size={14} className="text-tropical-lime" aria-hidden="true" />
                  Arrive
                </span>
                <input type="date" name="from" required className="field" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="inline-flex items-center gap-2 text-soft-gray">
                  <CalendarDays size={14} className="text-tropical-lime" aria-hidden="true" />
                  Depart
                </span>
                <input type="date" name="to" required className="field" />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="inline-flex items-center gap-2 text-soft-gray">
                  <Users size={14} className="text-tropical-lime" aria-hidden="true" />
                  Guests
                </span>
                <input
                  type="number"
                  name="guests"
                  min={1}
                  max={booking.guestsMax}
                  defaultValue={2}
                  required
                  className="field"
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="text-soft-gray">Full name</span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="Amelia Hart"
                  required
                  className="field"
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="text-soft-gray">Email</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  className="field"
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="text-soft-gray">Phone / WhatsApp (optional)</span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  placeholder="+44 7700 900123"
                  className="field"
                />
              </label>

              <label className="grid gap-2 text-sm sm:col-span-2">
                <span className="text-soft-gray">Anything we should know?</span>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Honeymoon, a birthday, a non-negotiable dive day…"
                  className="field resize-none"
                />
              </label>

              <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-soft-gray/80">
                  No deposit until you approve the itinerary. We reply within 24 hours.
                </p>
                <button type="submit" className="btn-lime shrink-0">
                  Request my itinerary
                  <Send size={16} aria-hidden="true" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
