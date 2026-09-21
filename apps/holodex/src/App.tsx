import { useSyncExternalStore, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouteControllerContext } from './app-context';
import type { RouteController } from './route-controller';
import { parseRoute, type Route } from './routes';
import { Shell } from './components/Shell';
import { HolodexErrorBoundary } from './components/ErrorBoundary';
import { NotFoundView } from './views/NotFoundView';
import { SetsView } from './views/SetsView';
import { SetView } from './views/SetView';

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
    case 'home':
      return <SetsView />;
    case 'set':
      return <SetView setId={route.setId} filters={route.filters} />;
    case 'search':
    case 'collection':
    case 'card':
      return <p className="text-holo-muted">View “{route.view}” lands in a later task.</p>;
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
          <HolodexErrorBoundary key={routeString}>{renderView(route)}</HolodexErrorBoundary>
        </Shell>
      </RouteControllerContext.Provider>
    </QueryClientProvider>
  );
}
