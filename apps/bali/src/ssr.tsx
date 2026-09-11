import css from './styles/globals.css?inline';
import App from './App';

export interface RenderHeroSSRResult {
  html: string;
  /** Compiled Tailwind CSS, for the host to inline so first paint is styled. */
  css: string;
}

export interface RenderHeroSSROptions {
  config?: unknown;
  /** Accepted for parity with other remotes; unused (all media is absolute URLs). */
  assetBase?: string;
}

/**
 * SSR entry: renders the page to an HTML string plus its compiled CSS. Every
 * scroll animation is GSAP-driven from effects, so the server markup is simply
 * the final, visible layout — identical to what `./hydrate` renders. The only
 * intentionally hidden markup is the hero's scroll-revealed copy, which a
 * <noscript> rule in App.tsx shows for no-JS readers.
 *
 * `react-dom/server` is imported dynamically so it never enters the client
 * bundle's federation graph.
 */
export async function renderHeroSSR(
  _options: RenderHeroSSROptions = {},
): Promise<RenderHeroSSRResult> {
  const { renderToString } = await import('react-dom/server');
  return { html: renderToString(<App />), css };
}

export default renderHeroSSR;
