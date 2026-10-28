import type { SsrResult } from '@ncam/mf-remote';
import App from './App';
import { createRouteController } from './route-controller';
import css from './styles/app.css?inline';

export interface RenderHeroSSROptions {
  config?: { route?: string };
  assetBase?: string;
}

/** Server render. `react-dom/server` is imported dynamically so it never enters the client graph. */
export async function renderHeroSSR(options: RenderHeroSSROptions = {}): Promise<SsrResult> {
  const { renderToString } = await import('react-dom/server');
  const controller = createRouteController({ route: options.config?.route ?? '/' });
  return { html: renderToString(<App controller={controller} />), css };
}

export default renderHeroSSR;
