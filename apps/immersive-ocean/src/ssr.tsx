import { originOf, rebaseCssUrls } from '@ncam/mf-remote/css';
import fontsCss from './styles/fonts.css?inline';
import css from './styles/globals.css?inline';
import App from './App';

export interface RenderHeroSSRResult {
  html: string;
  /** Compiled Tailwind CSS and the @font-face rules, for the host to inline so first paint is styled. */
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
  // The @font-face rules ride along, so the first paint asks for the fonts
  // (not ./hydrate, seconds later). Their files are this remote's, and the
  // host inlines the CSS into its own page: name them from the origin the
  // host's loader fetched this module from.
  const styles = rebaseCssUrls(fontsCss, originOf(import.meta.url)) + css;
  return { html: renderToString(<App />), css: styles };
}

export default renderHeroSSR;
