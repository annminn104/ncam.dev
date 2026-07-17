import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFade } from '../../lib/motion';
import { buttonVariants } from '../ui/button';
import { ConcentricLogo } from '../common/concentric-logo';
import { mindloopConfig as config } from '../../data/mindloop';

export function CTA() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fade = useFade();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: { destroy(): void } | undefined;
    let cancelled = false;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = config.videos.ctaHls; // native HLS (Safari)
    } else {
      // Lazy-load hls.js on the client only — keeps the SSR entry importable.
      void import('hls.js').then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;
        const inst = new Hls();
        inst.loadSource(config.videos.ctaHls);
        inst.attachMedia(video);
        hls = inst;
      });
    }
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, []);

  return (
    <section className="relative overflow-hidden border-t border-border/30 py-32 md:py-44">
      <video
        ref={videoRef}
        className="absolute inset-0 z-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 z-[1] bg-background/45" />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-6 text-center">
        <motion.div {...fade(0)}>
          <ConcentricLogo outer="w-10 h-10" inner="w-5 h-5" />
        </motion.div>
        <motion.h2 {...fade(0.1)} className="mt-6 text-5xl md:text-7xl">
          Start Your <span className="font-serif italic">Journey</span>
        </motion.h2>
        <motion.p {...fade(0.2)} className="mt-4 text-lg text-muted-foreground">
          {config.cta.subtitle}
        </motion.p>
        <motion.div
          {...fade(0.3)}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className={cn(buttonVariants({ variant: 'default', radius: 'lg' }), 'px-8 py-3.5')}
          >
            {config.cta.primaryLabel}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className={cn(buttonVariants({ variant: 'glass', radius: 'lg' }), 'gap-2 px-8 py-3.5')}
          >
            {config.cta.secondaryLabel} <ArrowRight className="h-4 w-4" />
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
