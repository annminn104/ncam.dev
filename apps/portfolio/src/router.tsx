import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { NotFound } from './components/NotFound';
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary';

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    // Recommended TanStack Router defaults (docs: creating-a-router).
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultStructuralSharing: true,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: DefaultCatchBoundary,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
