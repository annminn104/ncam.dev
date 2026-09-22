import { StrictMode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { HydrationBoundary } from '@tanstack/react-query';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import App from './App';
import { createRouteController, type RouteController } from './route-controller';
import { createQueryClient } from './lib/queries';
import { parseState, readStateJson, SSR_STATE_ID } from './lib/ssr-state';
import { disposeHoloCache } from './holo/teardown';

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
  // type="application/json"> inside target itself. It has to be read before
  // hydrateRoot, because react-query needs the state to build its client, and
  // it is then rendered straight back below so the element has a counterpart
  // in the tree instead of being a stray child of the hydration root. Missing
  // or corrupt is fine: parseState degrades to undefined and react-query just
  // fetches on the client, same as a route SSR never prefetched.
  const stateJson = readStateJson(target.ownerDocument ?? document);
  const state = parseState(stateJson);
  const root = hydrateRoot(
    target,
    <StrictMode>
      {/* App renders its own QueryClientProvider internally, below this
          element, so this boundary cannot read the client back out of
          context — pass the same instance explicitly, as ./ssr does. */}
      <HydrationBoundary state={state as never} queryClient={queryClient}>
        <App controller={controller} queryClient={queryClient} />
        {/* Same element ./ssr rendered, with the same text, so hydration has
            nothing to reconcile here. */}
        <script
          type="application/json"
          id={SSR_STATE_ID}
          dangerouslySetInnerHTML={{ __html: stateJson ?? '' }}
        />
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
  queueMicrotask(() => {
    root.unmount();
    // Frees every cached holo shader program, through teardown.ts's
    // three-free indirection rather than importing program-cache.ts here
    // directly — program-cache.ts imports three.js, and a static or dynamic
    // import of it here would pull that into this path whether or not a
    // card ever rendered a holo foil. teardown.ts imports nothing from
    // three, so this static import costs nothing on a hydration that never
    // saw a HoloCard, and disposeHoloCache() is a no-op until
    // program-cache.ts has actually registered itself (which only happens
    // via HoloCard's own dynamic import('./scene')).
    //
    // Correct as written because the remote is mounted once today — roots is
    // keyed by target in a WeakMap, so if a page ever hosted two Holodex
    // mounts, the first one to unmount would free materials the second mount
    // is still using. Worth knowing if that ever changes.
    disposeHoloCache();
  });
}

export default hydrate;
