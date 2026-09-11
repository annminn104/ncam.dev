import { TreePalm } from 'lucide-react';
import { brand } from '../../data/bali';
import { cn } from '../../lib/utils';

interface LogoProps {
  className?: string;
  /** Called on click (e.g. close the mobile menu). */
  onClick?: () => void;
}

export function Logo({ className, onClick }: LogoProps) {
  const [display, serif] = brand.wordmark;
  return (
    <a
      href="#home"
      onClick={onClick}
      aria-label={`${brand.name} — back to top`}
      className={cn('group inline-flex items-center gap-2.5', className)}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-tropical-lime text-jungle-black transition-shadow duration-500 group-hover:shadow-lime">
        <TreePalm size={18} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="flex items-baseline gap-1 leading-none">
        <span className="font-display text-xl tracking-[0.12em] text-off-white">{display}</span>
        <span className="font-serif text-lg italic text-tropical-lime">{serif}</span>
      </span>
    </a>
  );
}
