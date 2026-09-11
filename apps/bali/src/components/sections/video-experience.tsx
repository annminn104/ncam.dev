import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { film, unsplash } from '../../data/bali';
import { gsap, useGsap } from '../../lib/gsap';
import { Modal } from '../ui/modal';
import { Accent } from '../ui/section-heading';

export function VideoExperience() {
  const sectionRef = useRef<HTMLElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const [playing, setPlaying] = useState(false);
  const close = useCallback(() => setPlaying(false), []);

  // Slow vertical parallax on the poster while the section crosses the viewport.
  useGsap(() => {
    const section = sectionRef.current;
    const poster = posterRef.current;
    if (!section || !poster) return;
    gsap.fromTo(
      poster,
      { yPercent: -10 },
      {
        yPercent: 10,
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });

  return (
    <section
      id="film"
      ref={sectionRef}
      className="relative h-[80vh] min-h-[560px] overflow-hidden scroll-mt-28"
    >
      <img
        ref={posterRef}
        src={unsplash(film.poster, 2000)}
        alt={film.posterAlt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full scale-125 object-cover will-change-transform"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,11,13,0.25)_0%,rgba(5,11,13,0.85)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-jungle-black to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-jungle-black to-transparent"
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <motion.button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="Play the film"
          aria-haspopup="dialog"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="pulse-ring relative inline-flex h-24 w-24 items-center justify-center rounded-full bg-tropical-lime text-jungle-black shadow-lime-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-off-white focus-visible:ring-offset-4 focus-visible:ring-offset-jungle-black"
        >
          <Play size={34} className="ml-1" fill="currentColor" aria-hidden="true" />
        </motion.button>
        <p className="eyebrow mt-10">{film.eyebrow}</p>
        <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-off-white md:text-6xl">
          {film.title} <Accent>{film.accent}</Accent>
        </h2>
        <p className="mt-5 max-w-xl text-soft-gray">{film.description}</p>
      </div>

      <a
        href={film.credit.href}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-4 right-4 z-10 max-w-[70vw] text-right text-[10px] leading-snug text-off-white/50 transition-colors hover:text-off-white sm:right-6"
      >
        {film.credit.text}
      </a>

      <Modal
        open={playing}
        onClose={close}
        label="Bali Adventure film"
        className="w-full max-w-5xl"
      >
        {playing ? (
          <video
            controls
            autoPlay
            playsInline
            poster={unsplash(film.poster, 1600)}
            className="aspect-video w-full rounded-2xl bg-black shadow-2xl"
          >
            {film.sources.map((source) => (
              <source key={source.src} src={source.src} type={source.type} />
            ))}
            Your browser cannot play this video.{' '}
            <a href={film.sources[0].src} className="underline">
              Download the film
            </a>
            .
          </video>
        ) : null}
      </Modal>
    </section>
  );
}
