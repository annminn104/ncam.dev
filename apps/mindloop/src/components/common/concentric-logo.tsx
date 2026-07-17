import { cn } from '../../lib/utils';

/** The Mindloop mark — two concentric rings. Sizes are passed as classes. */
export function ConcentricLogo({ outer, inner }: { outer: string; inner: string }) {
  return (
    <span className="relative inline-flex items-center justify-center" aria-hidden="true">
      <span
        className={cn(
          'flex items-center justify-center rounded-full border-2 border-foreground/60',
          outer,
        )}
      >
        <span className={cn('rounded-full border border-foreground/60', inner)} />
      </span>
    </span>
  );
}
