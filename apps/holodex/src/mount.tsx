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
  });
}

export default mount;
