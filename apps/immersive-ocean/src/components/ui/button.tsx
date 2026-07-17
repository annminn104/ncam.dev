import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'glass' | 'ghost';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary:
    'bg-white text-black shadow-lg shadow-black/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-white/20 active:translate-y-0',
  glass:
    'border border-white/20 bg-white/5 text-white backdrop-blur-md hover:border-white/40 hover:bg-white/10',
  ghost: 'text-white/70 hover:text-white',
};

const sizes: Record<Size, string> = {
  sm: 'px-5 py-2 text-sm',
  md: 'px-7 py-3.5 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
