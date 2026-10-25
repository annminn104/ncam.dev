import { useEffect, useRef, type RefObject } from 'react';
import type { Engine } from '../engine/engine';
import type { Settings } from '../engine/settings';

interface Props {
  settings: Settings;
  engineRef: RefObject<Engine | null>;
  /** The first frame is on screen: fade the canvas in. */
  live: boolean;
  onReady(): void;
  onFail(error: unknown): void;
  onFps(fps: number): void;
  onCruiseChange(on: boolean): void;
}

/** Wait `n` frames, so a state change paints before the engine's long synchronous setup. */
function nextFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left === 0) resolve();
      else requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

/**
 * Boots the engine on a fresh canvas — StrictMode's double mount must not reuse a lost context.
 * The engine is a chunk of its own, loaded here and nowhere earlier.
 */
export function SceneCanvas({
  settings,
  engineRef,
  live,
  onReady,
  onFail,
  onFps,
  onCruiseChange,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onReady, onFail, onFps, onCruiseChange });
  callbacks.current = { onReady, onFail, onFps, onCruiseChange };
  const latest = useRef(settings);
  latest.current = settings;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'ms-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      'The diorama, live: drag to orbit, scroll to zoom, click the glass door to open it',
    );
    host.appendChild(canvas);
    let engine: Engine | null = null;
    let cancelled = false;
    void (async () => {
      try {
        await nextFrames(2);
        const { Engine } = await import('../engine/engine');
        if (cancelled) return;
        engine = new Engine(canvas, latest.current, {
          onReady: () => callbacks.current.onReady(),
          onFps: (fps) => callbacks.current.onFps(fps),
          onCruiseChange: (on) => callbacks.current.onCruiseChange(on),
        });
        engineRef.current = engine;
      } catch (error) {
        // A constructor that failed after creating its context (a shader the device refuses)
        // leaves it alive until the page is collected; release it so retries do not pile up.
        try {
          canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
        } catch {
          // nothing to release, and the failure below is what the visitor needs to see
        }
        if (!cancelled) callbacks.current.onFail(error);
      }
    })();
    return () => {
      cancelled = true;
      engine?.dispose();
      if (engineRef.current === engine) engineRef.current = null;
      canvas.remove();
    };
  }, [engineRef]);

  useEffect(() => {
    engineRef.current?.setSettings(settings);
  }, [settings, engineRef]);

  return <div ref={hostRef} className={live ? 'ms-scene is-live' : 'ms-scene'} />;
}
