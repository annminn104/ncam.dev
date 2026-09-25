import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { createLogger } from '@ncam/logger';
import css from './styles/globals.css?inline';
import App from './App';
import {
  cardQuery,
  createQueryClient,
  searchQuery,
  setCardsQuery,
  setQuery,
  setsQuery,
} from './lib/queries';
import { createRouteController } from './route-controller';
import { parseRoute } from './routes';
import { serialiseState, SSR_STATE_ID } from './lib/ssr-state';
import { DEFAULT_PER_PAGE } from './lib/tcgdex';
import type { QueryClient } from '@tanstack/react-query';

const log = createLogger({ scope: 'holodex' });

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
 * Warm the cache for the route being rendered.
 *
 * Every prefetch goes through the same factory the matching view calls
 * (`setsQuery`, `setQuery`, `setCardsQuery`, `searchQuery`, `cardQuery`) with
 * the same arguments, so the resulting query key is byte-identical to the
 * client's. A hand-rolled or inline key would not error — it would just miss
 * on hydration and refetch silently, throwing away this whole task.
 */
async function prefetch(client: QueryClient, route: ReturnType<typeof parseRoute>): Promise<void> {
  const jobs: Promise<void>[] = [];
  if (route.view === 'sets') jobs.push(client.prefetchQuery(setsQuery()));
  if (route.view === 'set') {
    // The page is cut from the set's card list, so it follows the set.
    jobs.push(
      client
        .fetchQuery(setQuery(route.setId))
        .then((set) =>
          client.prefetchQuery(setCardsQuery(route.setId, route.filters, DEFAULT_PER_PAGE, set)),
        ),
    );
  }
  if (route.view === 'search' && (route.filters.q || route.filters.type || route.filters.rarity)) {
    // client.prefetchQuery takes FetchQueryOptions, which has no `enabled`
    // field, so searchQuery's `enabled` guard (stopping an unfiltered
    // /search from paging the whole ~20,000-card catalogue) is silently
    // dropped here. This `if` repeats that same condition explicitly for the
    // server. It is NOT redundant with `enabled` — remove it and every
    // server render of /search pages the entire catalogue.
    jobs.push(client.prefetchQuery(searchQuery(route.filters, DEFAULT_PER_PAGE)));
  }
  if (route.view === 'card') jobs.push(client.prefetchQuery(cardQuery(route.cardId)));
  // One slow or failing endpoint must not fail the whole render: an
  // un-prefetched query just renders its skeleton and the client fetches it.
  await Promise.allSettled(jobs);
}

/**
 * SSR entry. `react-dom/server` is imported dynamically so it never enters the
 * client bundle's federation graph.
 *
 * One `RouteController` and one `QueryClient` per request — never a
 * module-level singleton, or two concurrent requests would share a cache.
 */
export async function renderHeroSSR(
  options: RenderHeroSSROptions = {},
): Promise<RenderHeroSSRResult> {
  const { renderToString } = await import('react-dom/server');
  const routeString = options.config?.route ?? '/';
  const queryClient = createQueryClient();
  const controller = createRouteController({ route: routeString });

  try {
    await prefetch(queryClient, parseRoute(routeString));
  } catch (error) {
    // A prefetch failure must not fail the render. prefetch() already
    // isolates one bad query from the rest via Promise.allSettled; this
    // catch is the backstop for anything else (parseRoute, or prefetch
    // itself, throwing). Log and fall through to render with whatever did
    // make it into the cache — an un-prefetched query renders its skeleton
    // and the client fetches it, same as if SSR had not run at all.
    log.warn('holodex.ssr-prefetch-failed', {
      route: routeString,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const state = dehydrate(queryClient);
  const body = renderToString(
    // App renders its own QueryClientProvider internally, below this
    // element, so HydrationBoundary cannot read the client back out of
    // context here — pass the same instance explicitly instead.
    <HydrationBoundary state={state} queryClient={queryClient}>
      <App controller={controller} queryClient={queryClient} />
      {/* Part of the React tree on purpose. The host injects this markup into
          the same div `hydrate` passes to hydrateRoot, so appending the script
          to the HTML string afterwards made it a child of the hydration root
          with no counterpart in the tree: React warns and strips it, and a
          root-level mismatch would client-render the whole remote. `hydrate`
          renders this element back with byte-identical text. */}
      <script
        type="application/json"
        id={SSR_STATE_ID}
        dangerouslySetInnerHTML={{ __html: serialiseState(state) }}
      />
    </HydrationBoundary>,
  );
  // Two concurrent SSR requests must never share a cache: this client was
  // built for this request alone, so drop it once the dehydrated snapshot
  // and the rendered markup have both been captured.
  queryClient.clear();

  return { html: body, css };
}

export default renderHeroSSR;
