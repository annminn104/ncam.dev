import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import css from './styles/globals.css?inline';
import './fonts';
import App from './App';

const STYLE_ID = 'viktor-styles';
const roots = new WeakMap<HTMLElement, Root>();

function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  doc.head.appendChild(el);
}

/** Federated entry: render the Viktor hero into `target` (CSR). */
export function mount(target: HTMLElement): () => void {
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
  return () => unmount(target);
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
