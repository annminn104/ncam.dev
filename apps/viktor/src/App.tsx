import { useEffect, useRef, useState } from 'react';
import { createLogger } from '@ncam/logger';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import posterSmall from './assets/water-wave-poster-640.webp';
import posterMedium from './assets/water-wave-poster-1280.webp';
import posterLarge from './assets/water-wave-poster-1920.webp';

const log = createLogger({ scope: 'viktor' });

/** What counts as the visitor being here: any of these, the first one. */
const INTERACTION_EVENTS = [
  'pointermove',
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const;

const VIDEO_URLS = [
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260629_030107_874273ea-684a-4e90-bb96-8fdfde48d53d.mp4',
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260629_032424_3c9c2a9d-807b-4482-80e6-dd6d9dfd4545.mp4',
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260627_094019_4214ea73-b963-46a4-8327-61489192de99.mp4',
];

export default function App() {
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    log.info('viktor.mounted');
  }, []);

  // All three play, hidden but running, so a switch is a crossfade between
  // videos already in motion. They start on the visitor's first interaction
  // (a mouse move is enough; never under reduced motion), over the first one's
  // poster: the markup has preload="none" and no autoplay. Playing with the
  // page, 38 MB of streams shared the network with the first screen, and the
  // video kept the screen changing for the whole load, which Speed Index
  // counts. They used to be fetched in full as blobs as well, twice over.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const controller = new AbortController();
    const start = () => {
      controller.abort();
      for (const video of videoRefs.current) void video?.play().catch(() => undefined);
    };
    for (const type of INTERACTION_EVENTS) {
      window.addEventListener(type, start, {
        once: true,
        passive: true,
        signal: controller.signal,
      });
    }
    return () => controller.abort();
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black font-figtree">
      {/* The first video's first frame, under the videos until they play. */}
      <img
        className="absolute inset-0 h-full w-full object-cover"
        src={posterMedium}
        srcSet={`${posterSmall} 640w, ${posterMedium} 1280w, ${posterLarge} 1920w`}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
      />
      {/* ── Video backgrounds (crossfade) ────────────────────────── */}
      {VIDEO_URLS.map((src, i) => (
        <video
          key={src}
          ref={(el) => {
            videoRefs.current[i] = el;
          }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out ${
            i === activeIndex ? 'opacity-100' : 'opacity-0'
          }`}
          src={src}
          preload="none"
          muted
          loop
          playsInline
          aria-hidden="true"
        />
      ))}

      {/* Dark overlay above videos */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-black/10" aria-hidden="true" />

      <Navbar />
      <Hero activeIndex={activeIndex} onSlideChange={setActiveIndex} />
    </div>
  );
}
