import { ArrowRight, Play } from 'lucide-react';
import { Button } from '../ui/button';
import { immersiveOceanConfig as config } from '../../data/immersive-ocean';

export function Hero() {
  return (
    <div className="relative z-10 flex h-full flex-col justify-between px-6 pb-12 pt-28 sm:px-8 sm:pb-16 sm:pt-32 md:px-12 md:pb-20 md:pt-36 lg:px-20 lg:pb-24">
      {/* Top */}
      <div className="max-w-3xl">
        <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 backdrop-blur-md animate-[fadeSlideUp_0.8s_ease_0.2s_both] sm:mb-7">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <span className="text-xs font-medium tracking-wide text-white/90 sm:text-sm">
            {config.badge}
          </span>
        </div>

        <h1 className="max-w-2xl bg-linear-to-br from-white via-white to-white/60 bg-clip-text text-3xl font-medium leading-[1.05] tracking-tight text-transparent animate-[fadeSlideUp_0.8s_ease_0.4s_both] sm:text-5xl md:text-6xl lg:text-7xl">
          {config.headingLines.map((line, i) => (
            <span key={i}>
              {line}
              {i < config.headingLines.length - 1 && <br />}
            </span>
          ))}
        </h1>
      </div>

      {/* Bottom */}
      <div className="max-w-lg">
        <p className="mb-7 max-w-sm text-sm leading-relaxed text-white/70 animate-[fadeSlideUp_0.8s_ease_0.7s_both] sm:max-w-md sm:text-base md:text-lg">
          {config.paragraph}
        </p>
        <div className="flex flex-wrap items-center gap-3 animate-[fadeSlideUp_0.8s_ease_0.9s_both] sm:gap-4">
          <Button variant="primary" className="group">
            {config.ctaLabel}
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Button>
          <Button variant="glass">
            <Play size={15} className="fill-current" />
            View Showreel
          </Button>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 animate-[fadeSlideUp_0.8s_ease_1.1s_both] sm:flex">
        <span className="text-[10px] uppercase tracking-[0.25em] text-white/50">Scroll</span>
        <span className="h-8 w-px bg-linear-to-b from-white/60 to-transparent" />
      </div>
    </div>
  );
}
