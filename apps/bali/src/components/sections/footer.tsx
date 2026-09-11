import { ArrowRight, Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Logo } from '../common/logo';
import { SocialIcon } from '../common/social-icon';
import { brand, footer } from '../../data/bali';

export function Footer() {
  const [subscribed, setSubscribed] = useState(false);

  const onSubscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubscribed(true);
  };

  return (
    <footer id="contact" className="scroll-mt-28 border-t border-white/10 bg-[#040a0c]">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1.2fr] lg:py-20">
        {/* Brand */}
        <div>
          <Logo />
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-soft-gray">{footer.blurb}</p>
          <ul className="mt-6 space-y-1 text-sm text-soft-gray">
            <li>
              <a
                href={`mailto:${brand.email}`}
                className="transition-colors hover:text-tropical-lime"
              >
                {brand.email}
              </a>
            </li>
            <li>
              <a href={brand.phoneHref} className="transition-colors hover:text-tropical-lime">
                {brand.phone}
              </a>
            </li>
            <li>{brand.address}</li>
          </ul>
          <ul className="mt-6 flex gap-3" aria-label="Social links">
            {footer.socials.map((social) => (
              <li key={social.kind}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  className="glass inline-flex h-10 w-10 items-center justify-center rounded-full text-off-white/80 transition-colors hover:border-tropical-lime hover:text-tropical-lime"
                >
                  <SocialIcon kind={social.kind} className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Explore */}
        <nav aria-label="Explore">
          <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-off-white">
            Explore
          </h3>
          <ul className="mt-5 space-y-3 text-sm">
            {footer.explore.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="nav-link">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Company */}
        <nav aria-label="Company">
          <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-off-white">
            Company
          </h3>
          <ul className="mt-5 space-y-3 text-sm">
            {footer.company.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="nav-link">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Newsletter */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-off-white">
            {footer.newsletter.title}
          </h3>
          <p className="mt-5 text-sm leading-relaxed text-soft-gray">{footer.newsletter.body}</p>
          {subscribed ? (
            <p
              role="status"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-tropical-lime/40 bg-tropical-lime/10 px-4 py-3 text-sm text-off-white"
            >
              <Check size={16} className="text-tropical-lime" aria-hidden="true" />
              {footer.newsletter.successBody}
            </p>
          ) : (
            <form onSubmit={onSubscribe} className="mt-5 flex gap-2">
              <label className="sr-only" htmlFor="bali-newsletter-email">
                Email address
              </label>
              <input
                id="bali-newsletter-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                className="field min-w-0 flex-1"
              />
              <button type="submit" aria-label="Subscribe" className="btn-lime shrink-0 px-4">
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 text-xs text-soft-gray/70 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {brand.name}. {footer.legal}.
          </p>
          <p>Made in Ubud, Bali · Photography via Unsplash</p>
        </div>
      </div>
    </footer>
  );
}
