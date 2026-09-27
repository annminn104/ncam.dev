import type { MountHandle } from '@ncam/mf-remote';
import { ToonHubCarousel } from './toonhub-carousel';
import { toonHubConfig, type ToonHubConfig } from './data/toonhub';

// No `hero.css` side-effect import here: when hydrating, the host already
// inlined the CSS from `./ssr`. (The CSR path in `./mount` injects it itself.)

interface Mounted {
  root: HTMLElement;
  instance: ToonHubCarousel;
}
const mounted = new WeakMap<HTMLElement, Mounted>();

function readConfig(root: HTMLElement, fallback: ToonHubConfig): ToonHubConfig {
  const raw = root.dataset.config;
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as ToonHubConfig;
  } catch {
    return fallback;
  }
}

/**
 * Attach the interactive controller to server-rendered hero markup already
 * present inside `target` (from `./ssr`). Does NOT touch innerHTML. Returns a
 * disposer. Client-only. The host's mount config, which it passes every remote,
 * is not needed: the markup carries the exact config it was rendered with.
 */
export function hydrate(target: HTMLElement): MountHandle {
  dispose(target);
  const root = target.querySelector<HTMLElement>('[data-toonhub-root]');
  if (!root) return () => undefined;
  // Use the exact config embedded during SSR so the controller matches the DOM.
  const instance = new ToonHubCarousel(root, readConfig(root, toonHubConfig));
  instance.init();
  mounted.set(target, { root, instance });
  return () => dispose(target);
}

export function dispose(target: HTMLElement): void {
  const existing = mounted.get(target);
  if (existing) {
    existing.instance.destroy();
    mounted.delete(target);
  }
}

export default hydrate;
