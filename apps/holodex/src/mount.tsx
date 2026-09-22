import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import css from './styles/globals.css?inline';
import App from './App';
import { createRouteController, type RouteController } from './route-controller';
import { createQueryClient } from './lib/queries';

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
    // Frees every cached holo shader program. Dynamically imported: a static
    // top-level import here would pull program-cache.ts — and the three.js
    // symbols it imports — into this module's own eager graph, which is
    // evaluated on every remote mount whether or not a card ever renders a
    // holo foil. HoloCard's own dynamic import('./scene') is the only other
    // path to program-cache.ts, so this keeps both paths equally lazy.
    //
    // Correct as written because the remote is mounted once today — roots is
    // keyed by target in a WeakMap, so if a page ever hosted two Holodex
    // mounts, the first one to unmount would free materials the second mount
    // is still using. Worth knowing if that ever changes.
    void import('./holo/program-cache').then(({ disposeMaterials }) => disposeMaterials());
  });
}

export default mount;
