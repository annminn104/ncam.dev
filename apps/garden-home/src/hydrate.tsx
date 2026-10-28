import { StrictMode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import type { MountConfig, MountHandle } from '@ncam/mf-remote';
import App from './App';
import { remoteBase } from './lib/asset-url';
import { releaseAll } from './release';

const roots = new WeakMap<HTMLElement, Root>();

/** Attach React to the server-rendered poster already in `target` (the host inlined the CSS). */
export function hydrate(target: HTMLElement, config?: MountConfig): MountHandle {
  const existing = roots.get(target);
  if (existing) {
    roots.delete(target);
    existing.unmount();
    releaseAll();
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
  queueMicrotask(() => {
    root.unmount();
    releaseAll();
  });
}

export default hydrate;
