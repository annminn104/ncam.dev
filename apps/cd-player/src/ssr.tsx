import type { SsrResult } from '@ncam/mf-remote';
import { originOf, rebaseCssUrls } from '@ncam/mf-remote/css';
import App from './App';
import { collectionHead } from './head';
import { createRouteController } from './route-controller';
import { parseRoute, routeCollection } from './routes';
import { loadInitial } from './server/initial';
import { serialiseState, SSR_STATE_ID } from './ssr-state';
import appCss from './styles/app.css?inline';
import fontsCss from './styles/fonts.css?inline';

export interface RenderHeroSSROptions {
  config?: { route?: string };
  /** Accepted for the host contract and ignored: assets are named from this module's own URL. */
  assetBase?: string;
}

/**
 * Server render: the overlays with the collection and its tracks, the backdrop, the poster, and the
 * fetched data in a JSON script that ./hydrate reads back. The scene never runs here.
 */
export async function renderHeroSSR(options: RenderHeroSSROptions = {}): Promise<SsrResult> {
  // Imported here, not at the top, so `react-dom/server` stays out of the client graph.
  const { renderToString } = await import('react-dom/server');
  const routeString = options.config?.route ?? '/';
  const route = parseRoute(routeString);
  // Never rejects: what fails or misses its budget is logged there, and the client fetches it.
  const initial = await loadInitial(routeCollection(route));
  const controller = createRouteController({ route: routeString });
  const html = renderToString(
    <>
      <App controller={controller} initial={initial} />
      <script
        type="application/json"
        id={SSR_STATE_ID}
        dangerouslySetInnerHTML={{ __html: serialiseState(initial) }}
      />
    </>,
  );
  // The @font-face rules ride along, named from the origin the host's loader fetched this module
  // from, so the first paint asks for this remote's font files.
  const css = rebaseCssUrls(fontsCss, originOf(import.meta.url)) + appCss;
  const head =
    route.view === 'collection' && initial.collection
      ? collectionHead(initial.collection)
      : undefined;
  return head ? { html, css, head } : { html, css };
}

export default renderHeroSSR;
