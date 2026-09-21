import css from './styles/globals.css?inline';
import App from './App';

export interface RenderHeroSSRResult {
  html: string;
  /** Compiled Tailwind CSS, for the host to inline so first paint is styled. */
  css: string;
}

export interface RenderHeroSSROptions {
  config?: { route?: string };
  assetBase?: string;
}

/**
 * SSR entry. `react-dom/server` is imported dynamically so it never enters the
 * client bundle's federation graph.
 */
export async function renderHeroSSR(
  _options: RenderHeroSSROptions = {},
): Promise<RenderHeroSSRResult> {
  const { renderToString } = await import('react-dom/server');
  return { html: renderToString(<App />), css };
}

export default renderHeroSSR;
