import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createLogger } from '@ncam/logger';
import { CardImage } from '../components/CardImage';
import { imageUrl } from '../lib/images';
import type { Card } from '../lib/tcgdex';
import { browserProbe, supportsHolo } from './capability';
import { foilTier } from './tiers';
import type { HoloScene } from './scene';

const log = createLogger({ scope: 'holodex' });

export function HoloCard({ card }: { card: Card }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HoloScene | null>(null);
  const [active, setActive] = useState(false);
  /** Bumped to force a rebuild after a restored WebGL context. */
  const [generation, setGeneration] = useState(0);

  const src = imageUrl(card.image, 'high');
  const tier = foilTier(card.rarity, card.variants);

  useEffect(() => {
    // Nothing to foil, or this visitor should not get WebGL at all.
    if (!src || tier === 'flat' || !supportsHolo(browserProbe())) return;
    let disposed = false;

    // three.js lives behind this dynamic import: a grid or list view never
    // downloads it.
    void import('./scene')
      .then(async ({ createHoloScene }) => {
        const canvas = canvasRef.current;
        const host = hostRef.current;
        if (disposed || !canvas || !host) return;
        const scene = createHoloScene(canvas);
        sceneRef.current = scene;
        scene.setTier(tier);
        scene.resize(host.clientWidth, host.clientHeight);
        await scene.setCard(src);
        if (disposed) return;
        scene.start();
        setActive(true);
      })
      .catch((error) => {
        log.warn('holo.unavailable', {
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      disposed = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      setActive(false);
    };
  }, [src, tier, generation]);

  // Pause when off-screen or the tab is hidden — an idle RAF loop on a
  // portfolio page is pure battery drain.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !active) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !document.hidden) sceneRef.current?.start();
      else sceneRef.current?.stop();
    });
    observer.observe(host);
    const onVisibility = () => {
      if (document.hidden) sceneRef.current?.stop();
      else sceneRef.current?.start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onResize = () => sceneRef.current?.resize(host.clientWidth, host.clientHeight);
    window.addEventListener('resize', onResize);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
    };
  }, [active]);

  // A lost context falls back to the plain image rather than a black rectangle.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onLost = (event: Event) => {
      // preventDefault is what makes a restore possible at all.
      event.preventDefault();
      log.warn('holo.context-lost', { card: card.id });
      sceneRef.current?.stop();
      setActive(false);
    };
    const onRestored = () => {
      log.info('holo.context-restored', { card: card.id });
      // The old scene's GL objects died with the context. Drop it and let the
      // mount effect rebuild by flipping its input.
      sceneRef.current?.dispose();
      sceneRef.current = null;
      setGeneration((value) => value + 1);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [card.id]);

  // Phone tilt. iOS needs a user gesture to grant this, and a denial is normal
  // — the pointer path already works, so a failure is silent by design.
  useEffect(() => {
    if (!active || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    const onOrient = (event: DeviceOrientationEvent) => {
      const { beta, gamma } = event;
      if (beta === null || gamma === null) return;
      // gamma is left/right (-90..90), beta front/back (-180..180).
      sceneRef.current?.setPointer(
        Math.max(-1, Math.min(1, gamma / 35)),
        Math.max(-1, Math.min(1, (beta - 45) / 35)),
      );
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [active]);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    sceneRef.current?.setPointer(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
  };

  return (
    <div
      ref={hostRef}
      onPointerMove={onPointerMove}
      onPointerLeave={() => sceneRef.current?.setPointer(0, 0)}
      className="relative"
      style={{ aspectRatio: '63 / 88' }}
    >
      <CardImage
        base={card.image}
        name={card.name}
        quality="high"
        priority
        className={active ? 'invisible' : undefined}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full rounded-lg ${active ? '' : 'hidden'}`}
      />
    </div>
  );
}
