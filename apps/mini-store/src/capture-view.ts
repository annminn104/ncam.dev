import { POSTER_TIME, SETTLE_FRAMES } from './capture';

/**
 * Capture mode: the engine alone on a full-window canvas — no React, no UI, auto-orbit off, the
 * scene clock pinned at POSTER_TIME. window.__miniStoreReady turns true SETTLE_FRAMES frames
 * after the engine's first, for scripts/capture-poster.mjs to screenshot.
 */
export async function startCapture(el: HTMLElement): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block';
  el.appendChild(canvas);
  const { Engine } = await import('./engine/engine');
  const settle = (left: number): void => {
    if (left === 0) window.__miniStoreReady = true;
    else requestAnimationFrame(() => settle(left - 1));
  };
  new Engine(
    canvas,
    { cruise: false },
    { onReady: () => settle(SETTLE_FRAMES) },
    { freezeAt: POSTER_TIME },
  );
}
