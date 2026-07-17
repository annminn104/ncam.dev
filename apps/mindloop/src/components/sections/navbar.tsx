import { ConcentricLogo } from '../common/concentric-logo';
import { mindloopConfig as config, type SocialKind } from '../../data/mindloop';

// Monochrome inline brand glyphs — lucide dropped brand icons, and this keeps
// them recognisable while matching the SVG-placeholder approach used elsewhere.
function SocialIcon({ kind, className }: { kind: SocialKind; className?: string }) {
  if (kind === 'instagram') {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="Instagram"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === 'linkedin') {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="currentColor"
        role="img"
        aria-label="LinkedIn"
      >
        <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5 2.5 2.5 0 0 0 4.98 3.5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" role="img" aria-label="X">
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.9l-4.7-6.14L5.9 22H2.64l8.02-9.17L1.5 2h7.06l4.25 5.62L18.244 2zm-1.21 18h1.83L7.05 3.9H5.09L17.034 20z" />
    </svg>
  );
}

export function Navbar() {
  const { links, socials } = config.nav;
  return (
    <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-8 py-4 md:px-28">
      <div className="flex items-center gap-8">
        <a href="#" className="flex items-center gap-2">
          <ConcentricLogo outer="w-7 h-7" inner="w-3 h-3" />
          <span className="font-bold">{config.brand}</span>
        </a>
        <div className="hidden items-center gap-2 text-sm md:flex">
          {links.map((label, i) => (
            <span key={label} className="flex items-center gap-2">
              <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                {label}
              </a>
              {i < links.length - 1 && <span className="text-muted-foreground/50">•</span>}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {socials.map((kind) => (
          <a
            key={kind}
            href="#"
            className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full text-foreground/80 transition-colors hover:text-foreground"
            aria-label={`${kind} link`}
          >
            <SocialIcon kind={kind} className="h-4 w-4" />
          </a>
        ))}
      </div>
    </nav>
  );
}
