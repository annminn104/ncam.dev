import { StrictMode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import App from './App';
import { remoteBase } from './lib/asset-url';

const roots = new WeakMap<HTMLElement, Root>();

/** Attach React to the server-rendered lobby already present in `target`. */
export function hydrate(target: HTMLElement, config?: MountConfig): MountHandle {
  const existing = roots.get(target);
  if (existing) {
    roots.delete(target);
    existing.unmount();
  }
  const root = hydrateRoot(
    target,
    <StrictMode>
      <App assetBase={remoteBase(config?.assetBase)} />
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
