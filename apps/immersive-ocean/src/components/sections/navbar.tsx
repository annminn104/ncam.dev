import { Menu, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { immersiveOceanConfig as config } from '../../data/immersive-ocean';

export function Navbar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <nav className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 sm:px-8 md:px-12 md:py-7 lg:px-20">
      <div className="flex items-center gap-8 lg:gap-12">
        <a href="#" className="text-lg font-semibold tracking-tight text-white sm:text-xl">
          {config.brand}
        </a>
        <div className="hidden items-center gap-7 md:flex lg:gap-9">
          {config.nav.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="relative text-sm text-white/70 transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-white after:transition-all after:duration-300 hover:text-white hover:after:w-full"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <div className="flex items-center">
        <Button variant="primary" size="sm" className="hidden md:inline-flex">
          {config.talkLabel}
        </Button>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={onToggle}
          className="relative z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white backdrop-blur-md transition-transform active:scale-90 md:hidden"
        >
          <Menu
            size={22}
            className={cn(
              'absolute transition-all duration-300',
              open ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
            )}
          />
          <X
            size={22}
            className={cn(
              'absolute transition-all duration-300',
              open ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0',
            )}
          />
        </button>
      </div>
    </nav>
  );
}
