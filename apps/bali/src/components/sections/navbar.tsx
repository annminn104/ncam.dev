import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Logo } from '../common/logo';
import { brand, navLinks } from '../../data/bali';
import { useDialog } from '../../lib/use-dialog';

const EASE = [0.16, 1, 0.3, 1] as const;

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

export function Navbar() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useDialog(open, close);

  return (
    <header
      role="banner"
      className="fixed inset-x-0 z-50 flex justify-center px-4"
      // Standalone: 1.25rem from the top. Inside the portfolio host the stage
      // sets --stage-top-inset so the pill clears the host's fixed back button.
      style={{ top: 'var(--stage-top-inset, 1.25rem)' }}
    >
      <nav
        aria-label="Primary navigation"
        className="flex w-full max-w-5xl items-center justify-between gap-6 rounded-full border border-[rgba(196,213,42,0.3)] bg-[#071014]/80 py-2.5 pl-4 pr-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
      >
        <Logo />

        {/* Desktop links */}
        <ul className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="nav-link text-sm font-medium">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <a href="#booking" className="btn-lime hidden py-2.5 pl-5 pr-4 text-sm md:inline-flex">
          Book Now
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="bali-mobile-menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-off-white transition hover:border-tropical-lime hover:text-tropical-lime md:hidden"
        >
          <Menu size={20} />
        </button>
      </nav>

      {/* Mobile full-screen overlay */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="mobile-menu"
            id="bali-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-[90] flex flex-col bg-jungle-black/95 backdrop-blur-xl md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex items-center justify-between px-6 py-5">
              <Logo onClick={close} />
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-off-white transition hover:border-tropical-lime hover:text-tropical-lime"
              >
                <X size={22} />
              </button>
            </div>

            <motion.ul
              className="flex flex-1 flex-col items-center justify-center gap-5"
              variants={listVariants}
              initial="hidden"
              animate="show"
            >
              {navLinks.map((link, i) => (
                <motion.li key={link.href} variants={itemVariants}>
                  <a
                    href={link.href}
                    onClick={close}
                    className="flex items-baseline gap-3 font-display text-4xl tracking-[0.08em] text-off-white transition-colors hover:text-tropical-lime"
                  >
                    <span className="font-sans text-xs tracking-[0.3em] text-tropical-lime/70">
                      0{i + 1}
                    </span>
                    {link.label}
                  </a>
                </motion.li>
              ))}
            </motion.ul>

            <motion.div
              className="flex flex-col items-center gap-4 px-6 pb-10 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5, ease: EASE }}
            >
              <a href="#booking" onClick={close} className="btn-lime w-full max-w-xs">
                Book Now
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
              <a
                href={`mailto:${brand.email}`}
                className="text-sm text-soft-gray transition-colors hover:text-off-white"
              >
                {brand.email}
              </a>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
