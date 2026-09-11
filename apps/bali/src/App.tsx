import { useEffect } from 'react';
import { createLogger } from '@ncam/logger';
import './fonts';
import { ScrollTrigger } from './lib/gsap';
import { Navbar } from './components/sections/navbar';
import { Hero } from './components/sections/hero';
import { Destinations } from './components/sections/destinations';
import { Packages } from './components/sections/packages';
import { Experiences } from './components/sections/experiences';
import { Itinerary } from './components/sections/itinerary';
import { WhyChooseUs } from './components/sections/why-choose-us';
import { Gallery } from './components/sections/gallery';
import { VideoExperience } from './components/sections/video-experience';
import { Testimonials } from './components/sections/testimonials';
import { Booking } from './components/sections/booking';
import { Footer } from './components/sections/footer';

const log = createLogger({ scope: 'bali' });

/**
 * Re-measure every ScrollTrigger once late-arriving layout settles: web fonts
 * swapping in and images decoding both change section heights, and when this
 * remote is mounted by the host after `load` GSAP's own load-refresh has
 * already fired.
 */
function useScrollTriggerRefresh() {
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();
    const timer = window.setTimeout(refresh, 700);
    const fontsReady = document.fonts?.ready;
    let cancelled = false;
    void fontsReady?.then(() => {
      if (!cancelled) refresh();
    });
    window.addEventListener('load', refresh);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('load', refresh);
    };
  }, []);
}

export default function App() {
  useEffect(() => {
    log.info('bali.mounted');
  }, []);
  useScrollTriggerRefresh();

  return (
    <div
      data-bali-root
      className="min-h-screen overflow-x-clip bg-jungle-black font-sans text-off-white antialiased selection:bg-tropical-lime selection:text-jungle-black"
    >
      {/* The hero copy is hidden inline and revealed by GSAP on scroll. Without JS
          it would never appear — show it (the SSR markup is otherwise complete). */}
      <noscript
        dangerouslySetInnerHTML={{
          __html:
            '<style>[data-bali-root] [data-hero-content]{opacity:1!important;visibility:visible!important;transform:none!important}</style>',
        }}
      />
      <Navbar />
      <main>
        <Hero />
        <Destinations />
        <Packages />
        <Experiences />
        <Itinerary />
        <WhyChooseUs />
        <Gallery />
        <VideoExperience />
        <Testimonials />
        <Booking />
      </main>
      <Footer />
    </div>
  );
}
