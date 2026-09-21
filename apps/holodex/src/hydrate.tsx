import { StrictMode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import App from './App';

const roots = new WeakMap<HTMLElement, Root>();

/** Attach React to the server-rendered markup already present in `target`. */
export function hydrate(target: HTMLElement, _config: MountConfig = {}): MountHandle {
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
  const dispose: MountHandle = () => dispose_(target);
  return dispose;
}

function dispose_(target: HTMLElement): void {
  const root = roots.get(target);
  if (!root) return;
  roots.delete(target);
  queueMicrotask(() => root.unmount());
}

export default hydrate;
