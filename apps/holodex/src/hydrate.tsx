import { StrictMode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import App from './App';
import { createRouteController, type RouteController } from './route-controller';
import { createQueryClient } from './lib/queries';

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
  const root = hydrateRoot(
    target,
    <StrictMode>
      <App controller={controller} queryClient={queryClient} />
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
