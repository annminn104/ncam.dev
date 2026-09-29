import { useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { usePlayOnInteraction } from '../../lib/video';
import posterSmall from '../../assets/hero-poster-640.webp';
import posterMedium from '../../assets/hero-poster-1280.webp';
import posterLarge from '../../assets/hero-poster-1624.webp';
import { useFade } from '../../lib/motion';
import { buttonVariants } from '../ui/button';
import { Input } from '../ui/input';
import { mindloopConfig as config } from '../../data/mindloop';

function Avatar({ index }: { index: number }) {
  const shades = ['#3a3a3a', '#4d4d4d', '#606060'];
  const letters = ['M', 'K', 'A'];
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-[10px] font-medium text-foreground/80"
      style={{ background: shades[index % 3] }}
      aria-hidden="true"
    >
      {letters[index % 3]}
    </span>
  );
}

export function Hero() {
  const fade = useFade();
  const videoRef = useRef<HTMLVideoElement>(null);
  usePlayOnInteraction(videoRef);
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* The video's first frame, under it until it plays: the video is 22 MB
          and starts on the visitor's first interaction (lib/video.ts), where
          the scene used to be a black screen while a phone buffered it. */}
      <img
        className="absolute inset-0 h-full w-full object-cover"
        src={posterMedium}
        srcSet={`${posterSmall} 640w, ${posterMedium} 1280w, ${posterLarge} 1624w`}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
      />
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={config.videos.hero}
        preload="none"
        loop
        muted
        playsInline
      />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-64 bg-linear-to-t from-background to-transparent" />

      <div className="relative z-10 mx-auto max-w-3xl px-6 pt-28 text-center md:pt-32">
        <motion.div {...fade(0)} className="mb-6 flex items-center justify-center gap-3">
          <span className="flex -space-x-2">
            {[0, 1, 2].map((i) => (
              <Avatar key={i} index={i} />
            ))}
          </span>
          <span className="text-sm text-muted-foreground">{config.hero.subscribers}</span>
        </motion.div>

        <motion.h1
          {...fade(0.1)}
          className="text-5xl font-medium tracking-[-2px] md:text-7xl lg:text-8xl"
        >
          Get <span className="font-serif font-normal italic">Inspired</span> with Us
        </motion.h1>

        <motion.p
          {...fade(0.2)}
          className="mx-auto mt-6 max-w-xl text-lg"
          style={{ color: 'hsl(var(--hero-subtitle))' }}
        >
          {config.hero.subtitle}
        </motion.p>

        <motion.form
          {...fade(0.3)}
          onSubmit={(e) => e.preventDefault()}
          className="liquid-glass mx-auto mt-8 flex max-w-lg items-center gap-2 rounded-full p-2"
        >
          <Input
            type="email"
            required
            placeholder={config.hero.emailPlaceholder}
            aria-label="Email address"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              buttonVariants({ variant: 'default', radius: 'full' }),
              'shrink-0 px-8 py-3',
            )}
          >
            {config.hero.submitLabel}
          </motion.button>
        </motion.form>
      </div>
    </section>
  );
}
