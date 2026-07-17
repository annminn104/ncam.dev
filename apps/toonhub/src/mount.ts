import { ToonHubCarousel } from './toonhub-carousel';
import { toonHubConfig, type ToonHubConfig } from './data/toonhub';
import { renderHeroHTML } from './hero-template';
import './styles/hero.css';

interface Mounted {
  root: HTMLElement;
  instance: ToonHubCarousel;
}

const mounted = new WeakMap<HTMLElement, Mounted>();

/**
 * Rewrite root-relative asset paths (e.g. `/figurines/01.png`) to this remote's
 * own origin, so images load from the remote and not from the host shell (which
 * may live on a different origin).
 */
function withAssetBase(config: ToonHubConfig): ToonHubConfig {
  let origin = '';
  try {
    origin = new URL('.', import.meta.url).origin;
  } catch {
    origin = '';
  }
  if (!origin || origin === 'null') return config;
  return {
    ...config,
    items: config.items.map((item) => ({
      ...item,
      src: item.src.startsWith('/') ? origin + item.src : item.src,
    })),
  };
}

/**
 * Mount the TOONHUB hero into `target`. Returns a disposer that unmounts it.
 * This is the federated entry the shell loads at runtime.
 */
export function mount(target: HTMLElement, config: ToonHubConfig = toonHubConfig): () => void {
  unmount(target);
  const resolved = withAssetBase(config);
  target.innerHTML = renderHeroHTML(resolved);
  const root = target.querySelector<HTMLElement>('[data-toonhub-root]');
  if (!root) return () => undefined;
  const instance = new ToonHubCarousel(root, resolved);
  instance.init();
  mounted.set(target, { root, instance });
  return () => unmount(target);
}

export function unmount(target: HTMLElement): void {
  const existing = mounted.get(target);
  if (existing) {
    existing.instance.destroy();
    mounted.delete(target);
  }
  target.innerHTML = '';
}

export default mount;
