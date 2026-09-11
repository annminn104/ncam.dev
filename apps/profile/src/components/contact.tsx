import { ArrowUpRight, Check, Copy, Mail, Phone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { projects } from '@ncam/project-registry';
import { contact, profile, type SocialKind } from '../data/profile';
import { gsap, useGsap, useMagnetic } from '../lib/gsap';

// lucide dropped brand icons — small inline glyphs instead.
function SocialIcon({ kind, className }: { kind: SocialKind; className?: string }) {
  if (kind === 'github') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
      </svg>
    );
  }
  if (kind === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5 2.5 2.5 0 0 0 4.98 3.5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.3v2.2H7.4V14h2.8v8h3.3Z" />
    </svg>
  );
}

/**
 * Closing statement: the headline's words rise in on scroll, the primary CTA is
 * magnetic, and the email can be copied in one click. Doubles as the footer.
 */
export function Contact() {
  const sectionRef = useRef<HTMLElement>(null);
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);
  useMagnetic(primaryRef, 0.3);

  useGsap(() => {
    const section = sectionRef.current;
    if (!section) return;
    gsap.fromTo(
      section.querySelectorAll('.contact__word'),
      { yPercent: 110, opacity: 0, rotate: 4 },
      {
        yPercent: 0,
        opacity: 1,
        rotate: 0,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: section, start: 'top 65%', once: true },
      },
    );
  });

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
    } catch {
      // Clipboard unavailable (insecure context / permissions) — the mailto link still works.
    }
  };

  const live = projects.filter((project) => project.status === 'live').length;
  const year = new Date().getFullYear();

  return (
    <section id="contact" ref={sectionRef} className="sec contact" aria-labelledby="contact-title">
      <div className="sec__inner">
        <p className="label">Contact</p>
        <h2 id="contact-title" className="contact__title">
          {contact.title.map((word, i) => (
            <span key={word} className="contact__mask">
              <span
                className={`contact__word${i === contact.accentWordIndex ? ' contact__word--accent' : ''}`}
              >
                {word}
              </span>
            </span>
          ))}
        </h2>
        <p className="contact__lead">{contact.lead}</p>

        <div className="contact__actions">
          <a ref={primaryRef} href={`mailto:${profile.email}`} className="btn btn--primary">
            <Mail size={18} aria-hidden="true" />
            {profile.email}
          </a>
          <button type="button" onClick={copyEmail} className="btn btn--ghost" aria-live="polite">
            {copied ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <Copy size={18} aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy email'}
          </button>
          <a href={profile.phoneHref} className="btn btn--ghost">
            <Phone size={18} aria-hidden="true" />
            {profile.phone}
          </a>
        </div>

        <div className="contact__grid">
          <div className="contact__col">
            <h3>Elsewhere</h3>
            <ul>
              {profile.socials.map((social) => (
                <li key={social.kind}>
                  <a href={social.href} target="_blank" rel="noreferrer">
                    <SocialIcon kind={social.kind} className="contact__icon" />
                    {social.handle}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="contact__col">
            <h3>Currently</h3>
            <p>{contact.currently}</p>
            <p>{contact.responseNote}.</p>
          </div>
          <div className="contact__col">
            <h3>This site</h3>
            <p>
              TanStack Start host · {live} federated remotes ·{' '}
              <a href={profile.repoUrl} target="_blank" rel="noreferrer">
                source on GitHub <ArrowUpRight size={12} aria-hidden="true" />
              </a>
            </p>
          </div>
        </div>

        <footer className="home-footer">
          <span>
            © {year} {profile.name}
          </span>
          <span>Turborepo · TanStack Start · Module Federation · GSAP</span>
        </footer>
      </div>
    </section>
  );
}
