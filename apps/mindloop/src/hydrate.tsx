import { StrictMode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import './fonts';
import App from './App';

// No `globals.css` import here: when hydrating, the host already inlined the CSS
// from `./ssr`. (The CSR path in `./mount` injects it itself.)

const roots = new WeakMap<HTMLElement, Root>();

/**
 * Attach React to server-rendered markup already present in `target` (from
 * `./ssr`). Does not replace innerHTML. Returns a disposer. Client-only.
 */
export function hydrate(target: HTMLElement): () => void {
  // Clean any leftover root synchronously — safe here because hydrate() runs
  // from an async callback in the host, not during the host's render.
  const existing = roots.get(target);
  if (existing) {
    roots.delete(target);
    existing.unmount();
  }
  const root = hydrateRoot(
    target,
    <StrictMode>
      {/* Must match the SSR render (animate=false) for a clean hydration. */}
      <App animate={false} />
    </StrictMode>,
  );
  roots.set(target, root);
  return () => dispose(target);
}

export function dispose(target: HTMLElement): void {
  const root = roots.get(target);
  if (!root) return;
  roots.delete(target);
  // Defer: the host calls this disposer from an effect cleanup that may run
  // while React is still rendering. Unmounting synchronously then throws
  // "Attempted to synchronously unmount a root while React was already rendering".
  queueMicrotask(() => root.unmount());
}

export default hydrate;
