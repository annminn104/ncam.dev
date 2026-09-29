import { StrictMode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import App from './App';

// No fonts import here: when hydrating, the host already inlined the @font-face
// rules from `./ssr`. (The CSR path in `./mount` imports them itself.)

const roots = new WeakMap<HTMLElement, Root>();

/** Attach React to the server-rendered markup already present in `target`. */
export function hydrate(target: HTMLElement): () => void {
  const existing = roots.get(target);
  if (existing) {
    roots.delete(target);
    existing.unmount();
  }
  const root = hydrateRoot(
    target,
    <StrictMode>
      <App />
    </StrictMode>,
  );
  roots.set(target, root);
  return () => dispose(target);
}

export function dispose(target: HTMLElement): void {
  const root = roots.get(target);
  if (!root) return;
  roots.delete(target);
  queueMicrotask(() => root.unmount());
}

export default hydrate;
