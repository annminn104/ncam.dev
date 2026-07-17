import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import css from './styles/globals.css?inline';
import './fonts';
import App from './App';

const STYLE_ID = 'immersive-ocean-styles';
const roots = new WeakMap<HTMLElement, Root>();

// Inject the compiled Tailwind CSS as a <style> into the target's document.
// This works both standalone and when mounted cross-origin inside the host —
// unlike a JS `import './globals.css'`, which relies on the remote's own Vite
// dev client and doesn't inject when the module runs in the host page.
function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  doc.head.appendChild(el);
}

/** Federated entry: render the Immersive Ocean hero into `target` (CSR). */
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
  // Defer so we never unmount synchronously during the host's render.
  queueMicrotask(() => {
    root.unmount();
    // Remove our injected styles so the host isn't left with our preflight.
    doc.getElementById(STYLE_ID)?.remove();
  });
}

export default mount;
