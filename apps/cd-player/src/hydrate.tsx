import { StrictMode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import App from './App';
import { remoteBase } from './lib/asset-url';
import { createRouteController, type RouteController } from './route-controller';
import { readState, serialiseState, SSR_STATE_ID } from './ssr-state';

const roots = new WeakMap<HTMLElement, { root: Root; controller: RouteController }>();

/** Attach React to the server-rendered markup already in `target` (the host inlined the CSS). */
export function hydrate(target: HTMLElement, config: MountConfig = {}): MountHandle {
  const existing = roots.get(target);
  if (existing) {
    roots.delete(target);
    existing.root.unmount();
  }
  const controller = createRouteController(config);
  // Written by ./ssr inside the markup the host injected. Read before hydrateRoot, and rendered
  // back with the same text so the element has its counterpart in the tree. Markup without it has
  // no element to match, so none is rendered then: it would be a mismatch at the root.
  const initial = readState(target.ownerDocument ?? document);
  const root = hydrateRoot(
    target,
    <StrictMode>
      <App controller={controller} initial={initial} assetBase={remoteBase(config.assetBase)} />
      {initial && (
        <script
          type="application/json"
          id={SSR_STATE_ID}
          dangerouslySetInnerHTML={{ __html: serialiseState(initial) }}
        />
      )}
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
  });
}

export default hydrate;
