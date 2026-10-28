import { useSyncExternalStore } from 'react';
import type { RouteController } from './route-controller';
import { parseRoute, routeCollection } from './routes';

export interface AppProps {
  controller: RouteController;
}

/** Placeholder until the shell lands: names the collection the route shows. */
export default function App({ controller }: AppProps) {
  const route = useSyncExternalStore(
    controller.subscribe,
    controller.getRoute,
    controller.getRoute,
  );
  const ref = routeCollection(parseRoute(route));
  return (
    <main className="cdp-root">
      <h1>CD Player</h1>
      <p>
        {ref.type}/{ref.id}
      </p>
    </main>
  );
}
