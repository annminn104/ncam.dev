import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import css from './styles/globals.css?inline';
import App from './App';

const STYLE_ID = 'holodex-styles';
const roots = new WeakMap<HTMLElement, Root>();

function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  doc.head.appendChild(el);
}

/** Federated entry: render Holodex into `target` (CSR). */
export function mount(target: HTMLElement, _config: MountConfig = {}): MountHandle {
  injectStyles(target.ownerDocument ?? document);
  const existing = roots.get(target);
  if (existing) {
    roots.delete(target);
    existing.unmount();
  }
  const root = createRoot(target);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  roots.set(target, root);
  const dispose: MountHandle = () => unmount(target);
  return dispose;
}

export function unmount(target: HTMLElement): void {
  const doc = target.ownerDocument ?? document;
  const root = roots.get(target);
  if (!root) return;
  roots.delete(target);
  queueMicrotask(() => {
    root.unmount();
    doc.getElementById(STYLE_ID)?.remove();
  });
}

export default mount;
