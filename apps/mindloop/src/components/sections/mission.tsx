import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { useMotionEnabled } from '../../lib/motion';
import { mindloopConfig as config } from '../../data/mindloop';

function Word({
  children,
  progress,
  range,
  highlighted,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
  highlighted: boolean;
}) {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return (
    <motion.span
      style={{
        opacity,
        color: highlighted ? 'hsl(var(--foreground))' : 'hsl(var(--hero-subtitle))',
      }}
    >
      {children}{' '}
    </motion.span>
  );
}

function RevealParagraph({
  text,
  className,
  highlight = [],
}: {
  text: string;
  className?: string;
  highlight?: string[];
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'start 0.3'] });
  const words = text.split(' ');
  const animate = useMotionEnabled();

  // Static (SSR / hydrate): render words at full opacity, no scroll reveal.
  if (!animate) {
    return (
      <p className={className}>
        {words.map((word, i) => {
          const clean = word.replace(/[.,—]/g, '');
          const highlighted = highlight.includes(clean);
          return (
            <span
              key={i}
              style={{
                color: highlighted ? 'hsl(var(--foreground))' : 'hsl(var(--hero-subtitle))',
              }}
            >
              {word}{' '}
            </span>
          );
        })}
      </p>
    );
  }

  return (
    <p ref={ref} className={className}>
      {words.map((word, i) => {
        const start = i / words.length;
        const end = start + 1 / words.length;
        const clean = word.replace(/[.,—]/g, '');
        return (
          <Word
            key={i}
            progress={scrollYProgress}
            range={[start, end]}
            highlighted={highlight.includes(clean)}
          >
            {word}
          </Word>
        );
      })}
    </p>
  );
}

export function Mission() {
  return (
    <section className="px-6 pb-32 pt-0 md:pb-44">
      <div className="mx-auto flex max-w-4xl flex-col items-center">
        <video
          className="mb-16 aspect-square w-full max-w-[800px] object-cover"
          src={config.videos.mission}
          autoPlay
          loop
          muted
          playsInline
        />
        {config.mission.map((para, i) => (
          <RevealParagraph
            key={i}
            text={para.text}
            highlight={para.highlight}
            className={
              para.secondary
                ? 'mt-10 text-center text-xl font-medium md:text-2xl lg:text-3xl'
                : 'text-center text-2xl font-medium tracking-[-1px] md:text-4xl lg:text-5xl'
            }
          />
        ))}
      </div>
    </section>
  );
}
