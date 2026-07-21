import { useEffect, useRef, useState } from 'react';
import { createLogger } from '@ncam/logger';
import './fonts';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';

const log = createLogger({ scope: 'viktor' });

const VIDEO_URLS = [
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260629_030107_874273ea-684a-4e90-bb96-8fdfde48d53d.mp4',
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260629_032424_3c9c2a9d-807b-4482-80e6-dd6d9dfd4545.mp4',
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260627_094019_4214ea73-b963-46a4-8327-61489192de99.mp4',
];

export default function App() {
  const [activeIndex, setActiveIndex] = useState(0);
  // Start with the original CDN URLs; swap to blob URLs as each loads.
  const [videoSrcs, setVideoSrcs] = useState<string[]>(VIDEO_URLS);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    log.info('viktor.mounted');
  }, []);

  // Preload all videos as blobs so crossfade switching is instant.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const blobUrls: string[] = [];

    const loadAll = async () => {
      await Promise.all(
        VIDEO_URLS.map(async (url, i) => {
          try {
            const res = await fetch(url, { signal });
            if (!res.ok) return;
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            blobUrls[i] = blobUrl;
            objectUrlsRef.current[i] = blobUrl;
          } catch {
            // Network error or abort — keep original URL.
          }
        }),
      );

      if (!signal.aborted && blobUrls.some(Boolean)) {
        setVideoSrcs((prev) => prev.map((orig, i) => blobUrls[i] ?? orig));
      }
    };

    void loadAll();

    return () => {
      controller.abort();
      objectUrlsRef.current.forEach((u) => u && URL.revokeObjectURL(u));
      objectUrlsRef.current = [];
    };
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black font-figtree">
      {/* ── Video backgrounds (crossfade) ────────────────────────── */}
      {videoSrcs.map((src, i) => (
        <video
          key={i}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out ${
            i === activeIndex ? 'opacity-100' : 'opacity-0'
          }`}
          src={src}
          autoPlay
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
