import css from './styles/globals.css?inline';
import App from './App';

export interface RenderHeroSSRResult {
  html: string;
  /** Compiled Tailwind CSS, for the host to inline so first paint is styled. */
  css: string;
}

export interface RenderHeroSSROptions {
  config?: unknown;
  /** Accepted for parity with other remotes; unused. */
  assetBase?: string;
}

/**
 * SSR entry: renders the hero to an HTML string plus its compiled CSS. Entrance
 * animations are pure CSS keyframes (`fadeSlideUp`), so they run on first paint
 * without JS — no need to gate them for SSR. `react-dom/server` is imported
 * dynamically so it stays out of the client bundle.
 */
export async function renderHeroSSR(
  _options: RenderHeroSSROptions = {},
): Promise<RenderHeroSSRResult> {
  const { renderToString } = await import('react-dom/server');
  return { html: renderToString(<App />), css };
}

export default renderHeroSSR;
