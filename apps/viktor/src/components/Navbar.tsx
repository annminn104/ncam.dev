import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';

const NAV_ITEMS = [
  { index: '01', label: 'Works', href: '#works' },
  { index: '02', label: 'Services', href: '#services' },
  { index: '03', label: 'About', href: '#about' },
  { index: '04', label: 'Contact', href: '#contact' },
];

const EMAIL = 'Davies@gmail.com';

function LiveClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <time
      aria-label="Current time"
      className="text-xs leading-4 tracking-[-0.12px] font-medium uppercase text-white/80"
    >
      CUP {time}
    </time>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-10" role="banner">
      {/* ── Desktop / tablet bar ─────────────────────────────────────── */}
      <div className="mx-auto flex max-w-[1340px] items-center justify-between py-9 px-[15px] md-tablet:py-[30px] md-tablet:px-[18px] mobile:py-6 mobile:px-[18px]">
        {/* Left: nav links */}
        <nav aria-label="Primary navigation" className="mobile:hidden">
          <ul className="flex items-center gap-8 md-tablet:gap-4">
            {NAV_ITEMS.map((item) => (
              <li key={item.index}>
                <a href={item.href} className="nav-link-underline flex items-end gap-1 text-white">
                  <span className="text-[8px] leading-3 tracking-[-0.08px] font-medium uppercase text-white/60">
                    {item.index}
                  </span>
                  <span className="text-xs leading-4 tracking-[-0.12px] font-medium uppercase">
                    / {item.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile: hamburger */}
        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
          onClick={() => setMobileOpen((o) => !o)}
          className="hidden mobile:flex h-10 w-10 items-center justify-center text-white"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Right: email + clock */}
        <div className="flex items-center gap-6 mobile:ml-auto">
          <a
            href={`mailto:${EMAIL}`}
            className="nav-link-underline text-xs leading-4 tracking-[-0.12px] font-medium uppercase text-white/80 mobile:hidden"
          >
            {EMAIL}
          </a>
          <LiveClock />
        </div>
      </div>

      {/* ── Mobile slide-down panel ──────────────────────────────────── */}
      <div
        id="mobile-nav-panel"
        role="navigation"
        aria-label="Mobile navigation"
        className={cn(
          'hidden mobile:grid overflow-hidden transition-[grid-template-rows] duration-[420ms]',
          mobileOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
        style={{ transitionTimingFunction: 'var(--ease-spring)' }}
      >
        <div className="overflow-hidden">
          <nav className="flex flex-col gap-4 px-[18px] pb-8 pt-4">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.index}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-end gap-2 text-white"
              >
                <span className="text-[10px] leading-none tracking-[-0.08px] font-medium uppercase text-white/50 mb-1">
                  {item.index}
                </span>
                <span className="text-[28px] leading-8 tracking-[-0.84px] font-medium uppercase">
                  / {item.label}
                </span>
              </a>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
