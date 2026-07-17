import { useEffect, useState } from 'react';
import { createLogger } from '@ncam/logger';
import { immersiveOceanConfig as config } from './data/immersive-ocean';
import { Navbar } from './components/sections/navbar';
import { MobileMenu } from './components/sections/mobile-menu';
import { Hero } from './components/sections/hero';

const log = createLogger({ scope: 'immersive-ocean' });

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    log.info('immersive-ocean.mounted');
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black font-geist">
      {/* Looping background video — sits behind all content (no z-index). */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: '70% center' }}
        src={config.video}
        autoPlay
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
