import type { SocialKind } from '../../data/bali';

// lucide dropped brand icons — inline monochrome glyphs keep them recognisable
// and avoid cross-origin asset resolution when mounted in the host.
export function SocialIcon({ kind, className }: { kind: SocialKind; className?: string }) {
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
        aria-hidden="true"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.9l-4.7-6.14L5.9 22H2.64l8.02-9.17L1.5 2h7.06l4.25 5.62L18.244 2zm-1.21 18h1.83L7.05 3.9H5.09L17.034 20z" />
    </svg>
  );
}
