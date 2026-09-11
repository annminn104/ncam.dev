import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}

/** Editorial section header: lime eyebrow, big Outfit title, soft-gray lede. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'max-w-3xl',
        align === 'center' && 'mx-auto text-center [&_.eyebrow]:justify-center',
        className,
      )}
    >
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-off-white md:text-5xl lg:text-6xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-6 text-lg leading-relaxed text-soft-gray">{description}</p>
      ) : null}
    </div>
  );
}

/** Serif-italic lime accent word used inside titles. */
export function Accent({ children }: { children: ReactNode }) {
  return <em className="font-serif font-normal italic text-tropical-lime">{children}</em>;
}
