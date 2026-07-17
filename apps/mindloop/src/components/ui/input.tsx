import * as React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'w-full bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
