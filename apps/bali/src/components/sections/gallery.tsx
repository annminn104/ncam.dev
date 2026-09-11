import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { gallery, unsplash } from '../../data/bali';
import { useRevealChildren } from '../../lib/gsap';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/modal';
import { Accent, SectionHeading } from '../ui/section-heading';

export function Gallery() {
  const [index, setIndex] = useState<number | null>(null);
  const close = useCallback(() => setIndex(null), []);
  const gridRef = useRevealChildren<HTMLDivElement>({ y: 32, stagger: 0.08 });

  const step = useCallback((delta: number) => {
    setIndex((current) =>
      current === null ? current : (current + delta + gallery.length) % gallery.length,
    );
  }, []);

  useEffect(() => {
    if (index === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, step]);

  const active = index === null ? null : gallery[index];
  const position = index === null ? 0 : index + 1;

  return (
    <section id="gallery" className="scroll-mt-28 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Gallery"
          title={
            <>
              Shot by our guests, <Accent>unfiltered</Accent>
            </>
          }
          description="A few frames from recent journeys. Tap any image to view it full-screen."
        />

        <div
          ref={gridRef}
          className="mt-14 grid auto-rows-[160px] grid-cols-2 gap-3 md:auto-rows-[220px] md:grid-cols-4 md:gap-4"
        >
          {gallery.map((tile, i) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Open photo: ${tile.caption}`}
              className={cn(
                'group relative overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tropical-lime focus-visible:ring-offset-4 focus-visible:ring-offset-jungle-black',
                tile.span,
              )}
            >
              <img
                src={unsplash(tile.image, 1000)}
                alt={tile.alt}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-cinematic group-hover:scale-110"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-jungle-black/0 transition-colors duration-500 group-hover:bg-jungle-black/30"
              />
              <span className="absolute bottom-4 left-4 translate-y-3 text-xs font-semibold uppercase tracking-[0.2em] text-off-white opacity-0 transition-all duration-500 ease-cinematic group-hover:translate-y-0 group-hover:opacity-100">
                {tile.caption}
              </span>
              <span className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-jungle-black/50 text-off-white opacity-0 backdrop-blur-md transition-opacity duration-500 group-hover:opacity-100">
                <Maximize2 size={16} aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Borderless full-screen viewer */}
      <Modal
        open={active !== null}
        onClose={close}
        label="Photo viewer"
        hideClose
        className="flex h-full w-full items-center justify-center"
      >
        {active ? (
          <>
            <AnimatePresence mode="wait">
              <motion.img
                key={active.id}
                src={unsplash(active.image, 2000)}
                alt={active.alt}
                className="max-h-[82vh] max-w-full rounded-lg object-contain shadow-2xl"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.01 }}
                transition={{ duration: 0.35 }}
              />
            </AnimatePresence>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 text-sm text-off-white sm:p-6">
              <p className="pointer-events-auto rounded-full bg-jungle-black/60 px-4 py-2 backdrop-blur-md">
                {active.caption}
              </p>
              <p className="pointer-events-auto rounded-full bg-jungle-black/60 px-4 py-2 font-display tracking-[0.2em] backdrop-blur-md">
                {String(position).padStart(2, '0')} / {String(gallery.length).padStart(2, '0')}
              </p>
            </div>

            <button
              type="button"
              onClick={close}
              aria-label="Close photo viewer"
              className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-jungle-black/60 text-off-white backdrop-blur-md transition hover:text-tropical-lime sm:right-6 sm:top-6"
            >
              <X size={20} />
            </button>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-jungle-black/60 text-off-white backdrop-blur-md transition hover:text-tropical-lime sm:left-6"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-jungle-black/60 text-off-white backdrop-blur-md transition hover:text-tropical-lime sm:right-6"
            >
              <ChevronRight size={22} />
            </button>
          </>
        ) : null}
      </Modal>
    </section>
  );
}
