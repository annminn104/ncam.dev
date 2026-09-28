import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { sections } from '../../data/sections';
import { gsap, useGsap } from '../../lib/gsap';
import { ThemeToggle } from '../theme-toggle';

const BRAND = 'ncam';

/** Where the section links leave the bar for the drawer; matches home.css. */
const DESKTOP_NAV = '(min-width: 900px)';

const links = sections.filter((section) => section.id !== 'top');

export function HomeNav({ active }: { active: string }) {
  const progressRef = useRef<HTMLSpanElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();
  const drawerTitleId = useId();

  // Reading progress: scrubbed across the whole page.
  useGsap(() => {
    if (!progressRef.current) return;
    gsap.fromTo(
      progressRef.current,
      { scaleX: 0 },
      { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.4 } },
    );
  });

  // Once the bar is wide enough for the links again the menu button is gone,
  // so a drawer left open would have no way back to it.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_NAV);
    const onChange = () => {
      if (query.matches) drawerRef.current?.close();
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const openDrawer = () => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    drawer.showModal();
    setDrawerOpen(true);
    // Start keyboard and screen-reader users on the section they are in (or
    // the first one), rather than on whatever showModal() picks, which varies
    // by browser and was <body> in Chromium here.
    // Two lookups: one selector list would return whichever match comes first
    // in the tree, which is always the first link.
    (
      drawer.querySelector<HTMLAnchorElement>('.hnav-drawer__link[aria-current]') ??
      drawer.querySelector<HTMLAnchorElement>('.hnav-drawer__link')
    )?.focus();
  };
  // Every way out — the close button, a link, the backdrop, Escape — ends in
  // the dialog's `close` event, which is where `drawerOpen` is reset.
  const closeDrawer = () => drawerRef.current?.close();

  return (
    <>
      <header className="hnav">
        <span ref={progressRef} className="hnav__progress" aria-hidden="true" />
        <div className="hnav__inner">
          <a href="#top" className="hnav__brand" aria-label={`${BRAND}.dev — back to top`}>
            <span className="hnav__dot" aria-hidden="true" />
            {BRAND}.dev
          </a>
          <div className="hnav__end">
            <nav aria-label="Sections" className="hnav__nav">
              <ul className="hnav__links">
                {links.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="hnav__link"
                      data-active={active === section.id ? '' : undefined}
                      aria-current={active === section.id ? 'location' : undefined}
                    >
                      {section.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <ThemeToggle />
            <button
              type="button"
              className="hnav__menu"
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-controls={drawerId}
              aria-expanded={drawerOpen}
              onClick={openDrawer}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      {/* A sibling of the header, not a child: `.hnav`'s backdrop-filter makes
          it the containing block of anything fixed inside it, which would trap
          the drawer in the bar while it animates out of the top layer. As a
          modal <dialog> it gets focus containment, Escape and an inert page
          for free; home.css animates it in and out and locks the page's scroll. */}
      <dialog
        ref={drawerRef}
        id={drawerId}
        className="hnav-drawer"
        aria-labelledby={drawerTitleId}
        onClose={() => setDrawerOpen(false)}
        // The dialog fills the viewport and the panel is its only child, so a
        // click that lands on the dialog itself landed on the backdrop.
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
      >
        <div className="hnav-drawer__panel">
          <div className="hnav-drawer__head">
            <p id={drawerTitleId} className="hnav-drawer__title">
              Sections
            </p>
            <button
              type="button"
              className="hnav-drawer__close"
              aria-label="Close menu"
              onClick={closeDrawer}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <nav aria-label="Sections">
            <ol className="hnav-drawer__links">
              {links.map((section, index) => (
                <li key={section.id} style={{ '--i': index } as CSSProperties}>
                  <a
                    href={`#${section.id}`}
                    className="hnav-drawer__link"
                    data-active={active === section.id ? '' : undefined}
                    aria-current={active === section.id ? 'location' : undefined}
                    // Closing first gives the page its scroll back, so the
                    // link's own jump to the section still happens after.
                    onClick={closeDrawer}
                  >
                    <span className="hnav-drawer__index" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {section.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </dialog>
    </>
  );
}
