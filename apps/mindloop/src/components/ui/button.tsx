import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  {
    variants: {
      variant: {
        default: 'bg-foreground text-background hover:bg-foreground/90',
        glass: 'liquid-glass text-foreground',
        ghost: 'text-muted-foreground hover:text-foreground',
      },
      size: {
        default: 'px-8 py-3 text-sm',
        lg: 'px-8 py-3.5 text-sm',
        icon: 'h-10 w-10',
      },
      radius: {
        full: 'rounded-full',
        lg: 'rounded-lg',
        none: '',
      },
    },
    defaultVariants: { variant: 'default', size: 'default', radius: 'lg' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, radius, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, radius }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
