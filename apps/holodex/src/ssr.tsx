import css from './styles/globals.css?inline';
import App from './App';
import { createRouteController } from './route-controller';
import { createQueryClient } from './lib/queries';

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
 *
 * One `RouteController` and one `QueryClient` per request — never a
 * module-level singleton, or concurrent requests would share state. Data
 * prefetching and cache dehydration land in Task 17; for now this renders the
 * correct view shell for the requested route with an empty cache, which the
 * client fills in after hydration.
 */
export async function renderHeroSSR(
  options: RenderHeroSSROptions = {},
): Promise<RenderHeroSSRResult> {
  const { renderToString } = await import('react-dom/server');
  const controller = createRouteController({ route: options.config?.route });
  const queryClient = createQueryClient();
  const html = renderToString(<App controller={controller} queryClient={queryClient} />);
  return { html, css };
}

export default renderHeroSSR;
