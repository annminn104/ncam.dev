import heroCss from './styles/hero.css?inline';
import { toonHubConfig, type ToonHubConfig } from './data/toonhub';
import { renderHeroHTML } from './hero-template';

export interface RenderHeroSSROptions {
  config?: ToonHubConfig;
  /** Absolute origin to resolve root-relative asset paths against (the remote's
   *  own origin), since the server can't infer it. */
  assetBase?: string;
}

export interface RenderHeroSSRResult {
  html: string;
  /** The hero's scoped CSS, for the host to inline so first paint is styled. */
  css: string;
}

/**
 * SSR-safe entry: builds the hero's initial HTML (+ its scoped CSS) with no DOM
 * or browser APIs, so the host can render it server-side. Interactivity is added
 * later on the client via `./hydrate`.
 */
export function renderHeroSSR(options: RenderHeroSSROptions = {}): RenderHeroSSRResult {
  const config = options.config ?? toonHubConfig;
  const base = options.assetBase ?? '';
  const resolved: ToonHubConfig = base
    ? {
        ...config,
        items: config.items.map((item) => ({
          ...item,
          src: item.src.startsWith('/') ? base + item.src : item.src,
        })),
      }
    : config;
  return { html: renderHeroHTML(resolved), css: heroCss };
}

export default renderHeroSSR;
