import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import css from './styles/globals.css?inline';
import App from './App';
import { createRouteController, type RouteController } from './route-controller';
import { createQueryClient } from './lib/queries';
import { disposeHoloCache } from './holo/teardown';

const STYLE_ID = 'holodex-styles';
const roots = new WeakMap<HTMLElement, { root: Root; controller: RouteController }>();

function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  doc.head.appendChild(el);
}

/** Federated entry: render Holodex into `target` (CSR). */
export function mount(target: HTMLElement, config: MountConfig = {}): MountHandle {
  injectStyles(target.ownerDocument ?? document);
  const existing = roots.get(target);
  if (existing) {
    roots.delete(target);
    existing.root.unmount();
  }
  const controller = createRouteController(config);
  const queryClient = createQueryClient();
  const root = createRoot(target);
  root.render(
    <StrictMode>
      <App controller={controller} queryClient={queryClient} />
    </StrictMode>,
  );
  roots.set(target, { root, controller });
  const dispose: MountHandle = () => unmount(target);
  dispose.update = (route: string) => controller.setRoute(route);
  return dispose;
}

export function unmount(target: HTMLElement): void {
  const doc = target.ownerDocument ?? document;
  const root = roots.get(target)?.root;
  if (!root) return;
  roots.delete(target);
  queueMicrotask(() => {
    root.unmount();
    doc.getElementById(STYLE_ID)?.remove();
    // Frees every cached holo shader program, through teardown.ts's
    // three-free indirection rather than importing program-cache.ts here
    // directly — program-cache.ts imports three.js, and a static or dynamic
    // import of it here would pull that into this path whether or not a
    // card ever rendered a holo foil. teardown.ts imports nothing from
    // three, so this static import costs nothing on a mount that never saw
    // a HoloCard, and disposeHoloCache() is a no-op until program-cache.ts
    // has actually registered itself (which only happens via HoloCard's own
    // dynamic import('./scene')).
    //
    // Correct as written because the remote is mounted once today — roots is
    // keyed by target in a WeakMap, so if a page ever hosted two Holodex
    // mounts, the first one to unmount would free materials the second mount
    // is still using. Worth knowing if that ever changes.
    disposeHoloCache();
  });
}

export default mount;
