import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createLogger } from '@ncam/logger';
import { CardImage } from '../components/CardImage';
import { imageUrl } from '../lib/images';
import type { Card } from '../lib/tcgdex';
import { browserProbe, supportsHolo } from './capability';
import { selectHolo } from './select';
import { createShowcase, type Showcase } from './showcase';
import { useReducedMotion } from './use-reduced-motion';
import type { HoloScene } from './scene';

const log = createLogger({ scope: 'holodex' });

export function HoloCard({ card }: { card: Card }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HoloScene | null>(null);
  const showcaseRef = useRef<Showcase | null>(null);
  const [active, setActive] = useState(false);
  /** Bumped to force a rebuild after a restored WebGL context. */
  const [generation, setGeneration] = useState(0);
  /** Drives the wrapper's CSS scale on pointer-enter/leave. A ref would not
   *  re-render, so the transform would never actually apply. */
  const [popped, setPopped] = useState(false);
  // The pop is plain CSS, set below regardless of whether the WebGL layer
  // ever mounts, so it needs its own reduced-motion gate rather than relying
  // on supportsHolo()'s (which only guards the three.js scene).
  const reducedMotion = useReducedMotion();

  const src = imageUrl(card.image, 'high');
  const freshSelection = selectHolo(card);
  // selectHolo returns a fresh object every render. Rebuilt here from its own
  // primitive fields so the result is referentially stable unless the
  // effective selection actually changes — the mount effect below depends on
  // this object, and an unmemoised fresh object in its dependency array would
  // remount the scene (recompiling the shader and refetching the card) on
  // every render.
  const selection = useMemo(
    () => ({
      effect: freshSelection.effect,
      shape: freshSelection.shape,
      invert: freshSelection.invert,
    }),
    [freshSelection.effect, freshSelection.shape, freshSelection.invert],
  );

  useEffect(() => {
    // Computed once per effect run and reused below for the showcase's
    // `enabled` option. browserProbe().createContext opens a throwaway
    // WebGL2 context to answer this, and a second call here would be a
    // second one on every card mount — browsers cap live contexts near 16,
    // which is exactly the pressure the holo.context-lost path exists for.
    const holoSupported = supportsHolo(browserProbe());
    // Nothing to foil, or this visitor should not get WebGL at all.
    if (!src || selection.effect === 'basic' || !holoSupported) return;
    let disposed = false;
    let showcaseRaf = 0;

    // three.js lives behind this dynamic import: a grid or list view never
    // downloads it.
    void import('./scene')
      .then(async ({ createHoloScene }) => {
        const canvas = canvasRef.current;
        const host = hostRef.current;
        if (disposed || !canvas || !host) return;
        const scene = createHoloScene(canvas);
        sceneRef.current = scene;
        scene.setSelection(selection);
        scene.resize(host.clientWidth, host.clientHeight);
        await scene.setCard(src);
        if (disposed) return;
        scene.start();

        // The one-shot intro sweep. It needs its own per-frame driver since
        // the scene's RAF loop is private to scene.ts, and it is cancelled
        // the moment real pointer or tilt input arrives (onPointerMove,
        // onOrient below).
        const showcase = createShowcase({
          durationMs: 1400,
          // supportsHolo() already ruled out prefers-reduced-motion (and the
          // other capability checks) via the guard above, so `holoSupported`
          // is necessarily true by the time we get here — this wiring is
          // belt-and-braces, not the real gate. Passed through anyway: it
          // documents the dependency and costs nothing.
          enabled: holoSupported,
        });
        showcaseRef.current = showcase;
        showcase.start(performance.now());
        const driveShowcase = () => {
          if (!showcase.isActive()) return;
          const { x, y } = showcase.valueAt(performance.now());
          sceneRef.current?.setPointer(x, y);
          showcaseRaf = requestAnimationFrame(driveShowcase);
        };
        showcaseRaf = requestAnimationFrame(driveShowcase);

        setActive(true);
      })
      .catch((error) => {
        log.warn('holo.unavailable', {
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(showcaseRaf);
      showcaseRef.current = null;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      setActive(false);
    };
  }, [src, selection, generation]);

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
      // Real tilt input has arrived — the intro sweep should not fight it.
      showcaseRef.current?.cancel();
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
    // Real pointer input has arrived — the intro sweep should not fight it.
    showcaseRef.current?.cancel();
    const rect = host.getBoundingClientRect();
    sceneRef.current?.setPointer(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
  };

  const onPointerEnter = () => setPopped(true);

  const onPointerLeave = () => {
    // Consistent with onPointerMove: leaving with no move in between should
    // still be authoritative over the intro sweep, not leave it driving.
    showcaseRef.current?.cancel();
    sceneRef.current?.setPointer(0, 0);
    setPopped(false);
  };

  return (
    <div
      ref={hostRef}
      onPointerMove={onPointerMove}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="relative"
      style={{
        aspectRatio: '63 / 88',
        // Reduced motion means no animation at all, not just a faster one —
        // pin the wrapper at rest and drop the transition entirely rather
        // than let popped still swing the scale.
        transform: reducedMotion ? 'scale(1)' : popped ? 'scale(1.04)' : 'scale(1)',
        transition: reducedMotion ? undefined : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        // A permanent will-change keeps a compositor layer alive on every
        // card in a grid — only hint it while actually popped.
        willChange: popped ? 'transform' : undefined,
      }}
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
