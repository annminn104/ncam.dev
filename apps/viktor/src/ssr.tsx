import { originOf, rebaseCssUrls } from '@ncam/mf-remote/css';
import fontsCss from './styles/fonts.css?inline';
import css from './styles/globals.css?inline';
import App from './App';

export interface RenderHeroSSRResult {
  html: string;
  css: string;
}

export interface RenderHeroSSROptions {
  config?: unknown;
  assetBase?: string;
}

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
