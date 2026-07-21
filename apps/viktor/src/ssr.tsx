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
  return { html: renderToString(<App />), css };
}

export default renderHeroSSR;
