import { motion } from 'framer-motion';
import { useFade } from '../../lib/motion';
import { mindloopConfig as config, type PlatformKind } from '../../data/mindloop';

// Monochrome placeholder glyphs (swap for real brand PNGs if desired).
function PlatformIcon({ kind }: { kind: PlatformKind }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 6,
    strokeLinecap: 'round' as const,
  };
  return (
    <svg
      viewBox="0 0 200 200"
      className="h-40 w-40 text-foreground/85"
      role="img"
      aria-label={`${kind} icon`}
    >
      {kind === 'chatgpt' && (
        <path
          {...common}
          strokeLinejoin="round"
          d="M100 40 L152 70 L152 130 L100 160 L48 130 L48 70 Z M100 40 L100 100 L152 130 M100 100 L48 130"
        />
      )}
      {kind === 'perplexity' && (
        <g {...common}>
          <circle cx="78" cy="100" r="42" />
          <circle cx="122" cy="100" r="42" />
        </g>
      )}
      {kind === 'google' && (
        <g {...common}>
          <path d="M100 44 C112 82 118 88 156 100 C118 112 112 118 100 156 C88 118 82 112 44 100 C82 88 88 82 100 44 Z" />
        </g>
      )}
    </svg>
  );
}

export function SearchChanged() {
  const { platforms, subtitle, footnote } = config.search;
  const fade = useFade();
  return (
    <section className="px-6 pb-6 pt-52 text-center md:pb-9 md:pt-64">
      <motion.h2 {...fade(0)} className="text-5xl tracking-[-1px] md:text-7xl lg:text-8xl">
        Search has <span className="font-serif italic">changed.</span> Have you?
      </motion.h2>
      <motion.p
        {...fade(0.1)}
        className="mx-auto mb-24 mt-6 max-w-2xl text-lg text-muted-foreground"
      >
        {subtitle}
      </motion.p>

      <div className="mb-20 grid gap-12 md:grid-cols-3 md:gap-8">
        {platforms.map((p, i) => (
          <motion.div key={p.name} {...fade(0.1 * i)} className="flex flex-col items-center">
            <PlatformIcon kind={p.kind} />
            <h3 className="mt-4 text-base font-semibold">{p.name}</h3>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">{p.desc}</p>
          </motion.div>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground">{footnote}</p>
    </section>
  );
}
