import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createLogger } from '@ncam/logger';
import { CardImage } from '../components/CardImage';
import { cardImageBase, imageUrls, type ImageQuality } from '../lib/images';
import type { Card } from '../lib/tcgdex';
import { holoCanvasKey } from './canvas-key';
import { browserProbe, supportsHolo } from './capability';
import { selectHolo, type Printing } from './select';
import { createShowcase, type Showcase } from './showcase';
import { useReducedMotion } from './use-reduced-motion';
import type { HoloScene } from './scene';

const log = createLogger({ scope: 'holodex' });

export function HoloCard({
  card,
  variant,
  decorative = false,
  artQuality = 'high',
}: {
  card: Card;
  /** The printing shown, when not the normal one: selectHolo's `variant`. */
  variant?: Printing;
  /**
   * Something beside the card already names it (an effects-page tile's
   * caption), so the art is hidden from assistive technology instead of
   * announcing the name a second time.
   */
  decorative?: boolean;
  /**
   * The plain art under the canvas, shown until the scene is live: the card
   * page's high-res, or an effects tile's low-res, the very file the tile was
   * already showing, so going live does not blink through a placeholder while
   * the high-res loads. The scene's own texture is high-res either way.
   */
  artQuality?: ImageQuality;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** The live scene, for the pointer, tilt and visibility handlers below.
   *  Only the mount-effect run that built a scene sets or clears it. */
  const sceneRef = useRef<HoloScene | null>(null);
  const showcaseRef = useRef<Showcase | null>(null);
  /** The canvas key whose scene is live, or null. Compared with the current
   *  key below instead of being kept as a boolean, so the render that swaps in
   *  a fresh canvas is already inactive: the plain art shows at once, rather
   *  than a frame of the new, empty canvas until the old scene's cleanup runs. */
  const [liveKey, setLiveKey] = useState<string | null>(null);
  /** Bumped to rebuild, on a fresh canvas, after a restored WebGL context. */
  const [generation, setGeneration] = useState(0);
  /** Drives the wrapper's CSS scale on pointer-enter/leave. A ref would not
   *  re-render, so the transform would never actually apply. */
  const [popped, setPopped] = useState(false);
  // The pop is plain CSS, set below regardless of whether the WebGL layer
  // ever mounts, so it needs its own reduced-motion gate rather than relying
  // on supportsHolo()'s (which only guards the three.js scene).
  const reducedMotion = useReducedMotion();

  // One base for both the plain art below and the scene's texture, so the two
  // can never disagree — including on a subset-set card, whose art only
  // cardImageBase can find.
  const base = cardImageBase(card);
  // The files the scene textures from, WebP then PNG, as CardImage falls back:
  // some cards' art exists only as PNG. Memoised on the base, as the scene
  // effect reads the list; it keys on the first file (holoCanvasKey's `src`),
  // which the base decides, as it decides the rest.
  const textures = useMemo(() => imageUrls(base, 'high'), [base]);
  const src = textures[0] ?? null;
  const freshSelection = selectHolo(card, { variant });
  // selectHolo returns a fresh object every render. Rebuilt here from its own
  // primitive fields so the result is referentially stable unless the
  // effective selection actually changes — the mount effect below depends on
  // this object, and an unmemoised fresh object in its dependency array would
  // remount the scene (recompiling the shader and refetching the card) on
  // every render.
  //
  // `variant` is deliberately not a dependency: it reaches the scene only
  // through these fields. On a card it cannot change — one whose table
  // effect is not basic, regular-holo or sv-rare-holo that still lists a
  // reverse printing — listing it here rebuilt the whole scene on every toggle
  // for no visual change. The layout, the glow and the foil brightness are the
  // card's own, which `variant` never changes; they are fields here, the glow
  // read by its three numbers, because the scene sets them (and so
  // holoCanvasKey reads them too). If selectHolo ever grows
  // another output, it joins these, and holoCanvasKey must read it as well.
  const [glowR, glowG, glowB] = freshSelection.glow;
  const selection = useMemo(
    () => ({
      effect: freshSelection.effect,
      shape: freshSelection.shape,
      layout: freshSelection.layout,
      invert: freshSelection.invert,
      glow: [glowR, glowG, glowB] as [number, number, number],
      foilBrightness: freshSelection.foilBrightness,
    }),
    [
      freshSelection.effect,
      freshSelection.shape,
      freshSelection.layout,
      freshSelection.invert,
      glowR,
      glowG,
      glowB,
      freshSelection.foilBrightness,
    ],
  );

  // A new scene only ever builds on a new canvas: see holoCanvasKey.
  const canvasKey = holoCanvasKey({ cardId: card.id, src, selection, generation });
  const active = liveKey === canvasKey;

  useEffect(() => {
    // Computed once per effect run and reused below for the showcase's
    // `enabled` option. browserProbe().createContext opens a throwaway
    // WebGL2 context to answer this, and a second call here would be a
    // second one on every card mount — browsers cap live contexts near 16,
    // which is exactly the pressure the holo.context-lost path exists for.
    const holoSupported = supportsHolo(browserProbe());
    // Nothing to foil, or this visitor should not get WebGL at all.
    if (!src || selection.effect === 'basic' || !holoSupported) return;
    // This run's own canvas, keyed on exactly this run's inputs. Captured now,
    // not read off the ref later: by the time the import below settles, or
    // this run's cleanup fires, canvasRef can already hold the next run's.
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let lost = false;
    let scene: HoloScene | null = null;
    let showcaseRaf = 0;

    // A lost context falls back to the plain image rather than a black
    // rectangle. These listeners belong to this run alone: attached to this
    // run's canvas, closing over this run's scene, and removed by this run's
    // cleanup before it disposes anything. That is what keeps an outgoing
    // canvas away from the incoming scene. dispose() force-loses the context,
    // and the browser delivers the resulting webglcontextlost in a later task
    // — after the next run has already built its scene on its own canvas. A
    // listener that reached for sceneRef would stop that scene and hide it.
    // These cannot: they are detached before the event is even queued, they
    // only ever touch their own `scene`, and they clear `liveKey` only while
    // it still names this run's canvas.
    const onLost = (event: Event) => {
      // preventDefault is what makes a restore possible at all.
      event.preventDefault();
      log.warn('holo.context-lost', { card: card.id });
      lost = true;
      scene?.stop();
      setLiveKey((live) => (live === canvasKey ? null : live));
    };
    const onRestored = () => {
      log.info('holo.context-restored', { card: card.id });
      // This scene's GL objects died with the context, and its canvas must
      // never host another scene. Bumping generation changes the canvas key:
      // React mounts a fresh canvas, this run's cleanup disposes the old
      // scene (releasing the restored context with it), and the next run
      // builds on the new canvas.
      setGeneration((value) => value + 1);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    // three.js lives behind this dynamic import: a grid or list view never
    // downloads it.
    void import('./scene')
      .then(async ({ createHoloScene }) => {
        const host = hostRef.current;
        if (disposed || !host) return;
        const built = createHoloScene(canvas);
        scene = built;
        sceneRef.current = built;
        built.setSelection(selection);
        built.resize(host.clientWidth, host.clientHeight);
        await built.setCard(textures);
        // Torn down meanwhile, or the context died while the card loaded:
        // going live now would show an empty canvas instead of the art. A
        // restore, if one comes, rebuilds on a fresh canvas.
        if (disposed || lost) return;
        built.start();

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
          built.setPointer(x, y);
          showcaseRaf = requestAnimationFrame(driveShowcase);
        };
        showcaseRaf = requestAnimationFrame(driveShowcase);

        setLiveKey(canvasKey);
      })
      .catch((error) => {
        log.warn('holo.unavailable', {
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      disposed = true;
      // Detach first: dispose() below force-loses this canvas's context, and
      // the webglcontextlost that causes must find no listener of ours.
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      cancelAnimationFrame(showcaseRaf);
      showcaseRef.current = null;
      if (sceneRef.current === scene) sceneRef.current = null;
      scene?.dispose();
      setLiveKey((live) => (live === canvasKey ? null : live));
    };
    // canvasKey is built from every other value here (holoCanvasKey), so this
    // effect re-runs exactly when the <canvas> below is replaced, never on a
    // canvas it has already used.
  }, [canvasKey, card.id, selection, src, textures]);

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

  const onPointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
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
    // A <span> made block, not a <div>: on the effects page this sits inside
    // a tile's <button>, whose content must be phrasing content. data-effect
    // names the effect this card resolved to, for the effects page's tests and
    // for anyone checking a card in devtools.
    <span
      ref={hostRef}
      data-effect={selection.effect}
      onPointerMove={onPointerMove}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="relative block"
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
        base={base}
        name={card.name}
        quality={artQuality}
        priority
        decorative={decorative}
        className={active ? 'invisible' : undefined}
      />
      {/* Keyed on every input of a scene, so each scene gets a canvas no
          earlier scene has force-lost: see holoCanvasKey. */}
      <canvas
        key={canvasKey}
        ref={canvasRef}
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full rounded-lg ${active ? '' : 'hidden'}`}
      />
    </span>
  );
}
