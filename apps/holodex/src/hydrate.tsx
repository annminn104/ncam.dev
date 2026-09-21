import { StrictMode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { HydrationBoundary } from '@tanstack/react-query';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import App from './App';
import { createRouteController, type RouteController } from './route-controller';
import { createQueryClient } from './lib/queries';
import { readState } from './lib/ssr-state';

const roots = new WeakMap<HTMLElement, { root: Root; controller: RouteController }>();

/** Attach React to the server-rendered markup already present in `target`. */
export function hydrate(target: HTMLElement, config: MountConfig = {}): MountHandle {
  const existing = roots.get(target);
  if (existing) {
    roots.delete(target);
    existing.root.unmount();
  }
  const controller = createRouteController(config);
  const queryClient = createQueryClient();
  // Written by ./ssr into the markup the host injected — a <script
  // type="application/json"> inside target itself, so it hydrates along with
  // everything else. Missing or corrupt is fine: readState degrades to
  // undefined and react-query just fetches on the client, same as a route
  // SSR never prefetched.
  const state = readState(target.ownerDocument ?? document);
  const root = hydrateRoot(
    target,
    <StrictMode>
      {/* App renders its own QueryClientProvider internally, below this
          element, so this boundary cannot read the client back out of
          context — pass the same instance explicitly, as ./ssr does. */}
      <HydrationBoundary state={state as never} queryClient={queryClient}>
        <App controller={controller} queryClient={queryClient} />
      </HydrationBoundary>
    </StrictMode>,
  );
  roots.set(target, { root, controller });
  const dispose: MountHandle = () => dispose_(target);
  dispose.update = (route: string) => controller.setRoute(route);
  return dispose;
}

function dispose_(target: HTMLElement): void {
  const root = roots.get(target)?.root;
  if (!root) return;
  roots.delete(target);
  queueMicrotask(() => root.unmount());
}

export default hydrate;
