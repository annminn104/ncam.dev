import { useEffect, useRef, useState } from 'react';
import { createLogger } from '@ncam/logger';
import { usePlayOnInteraction } from './lib/video';
import posterSmall from './assets/hero-poster-640.webp';
import posterMedium from './assets/hero-poster-1280.webp';
import posterLarge from './assets/hero-poster-1920.webp';
import { immersiveOceanConfig as config } from './data/immersive-ocean';
import { Navbar } from './components/sections/navbar';
import { MobileMenu } from './components/sections/mobile-menu';
import { Hero } from './components/sections/hero';

const log = createLogger({ scope: 'immersive-ocean' });

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  usePlayOnInteraction(videoRef);

  useEffect(() => {
    log.info('immersive-ocean.mounted');
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black font-geist">
      {/* The video's first frame, under it until it plays (lib/video.ts): the
          scene from the first paint instead of black while the video buffers. */}
      <img
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: '70% center' }}
        src={posterMedium}
        srcSet={`${posterSmall} 640w, ${posterMedium} 1280w, ${posterLarge} 1920w`}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
      />
      {/* Looping background video — sits behind all content (no z-index). */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: '70% center' }}
        src={config.video}
        preload="none"
        muted
        loop
        playsInline
      />

      {/* Cinematic scrims: darken the text column (left) and top/bottom edges
          for legibility, while keeping the video visible on the right. */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/85 via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/50 via-transparent to-black/60" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 68% 42%, transparent 42%, rgba(0,0,0,0.45) 100%)',
        }}
      />

      <Navbar open={mobileMenuOpen} onToggle={() => setMobileMenuOpen((o) => !o)} />
      <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <Hero />
    </div>
  );
}
