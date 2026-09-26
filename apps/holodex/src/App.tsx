import { useSyncExternalStore, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouteControllerContext } from './app-context';
import type { RouteController } from './route-controller';
import { parseRoute, viewKey, type Route } from './routes';
import { Shell } from './components/Shell';
import { HolodexErrorBoundary } from './components/ErrorBoundary';
import { NotFoundView } from './views/NotFoundView';
import { SetsView } from './views/SetsView';
import { SetView } from './views/SetView';
import { SearchView } from './views/SearchView';
import { CardView } from './views/CardView';
import { CollectionView } from './views/CollectionView';
import { EffectsView } from './views/EffectsView';

export interface AppProps {
  controller: RouteController;
  queryClient: QueryClient;
}

/**
 * One arm per view. Tasks 9, 10, 11, 12 and 15 each peel one case off the
 * shared placeholder group above and give it a real component; `not-found`
 * stays last.
 */
function renderView(route: Route): ReactNode {
  switch (route.view) {
    case 'sets':
      return <SetsView />;
    case 'set':
      return <SetView setId={route.setId} filters={route.filters} />;
    case 'search':
      return <SearchView filters={route.filters} />;
    case 'card':
      return <CardView cardId={route.cardId} variant={route.variant} />;
    case 'collection':
      return <CollectionView />;
    case 'effects':
      return <EffectsView effect={route.effect} card={route.card} />;
    case 'not-found':
      return <NotFoundView path={route.path} />;
  }
}

export default function App({ controller, queryClient }: AppProps) {
  // The one subscription to the route store. Everything below re-renders when
  // the host pushes a new route through MountHandle.update().
  const routeString = useSyncExternalStore(
    controller.subscribe,
    controller.getRoute,
    controller.getRoute,
  );
  const route = parseRoute(routeString);

  return (
    <QueryClientProvider client={queryClient}>
      <RouteControllerContext.Provider value={controller}>
        <Shell>
          {/* Keyed on view identity, not the whole route: a filter, page or
              query change must stay inside one component instance (or the
              debounced search box loses focus mid-word), while a genuinely
              different view still gets a fresh boundary. */}
          <HolodexErrorBoundary key={viewKey(route)}>{renderView(route)}</HolodexErrorBoundary>
        </Shell>
      </RouteControllerContext.Provider>
    </QueryClientProvider>
  );
}
