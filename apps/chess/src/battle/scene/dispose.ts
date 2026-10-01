import type { BufferGeometry, Material, Texture } from 'three';

/** Geometries / materials / textures cached at module level, freed on battle unmount. */
const owned = new Set<BufferGeometry | Material | Texture>();
const resetters = new Set<() => void>();

/**
 * Hand a module-level resource to the battle: `disposeOwned()` frees it. Wrap everything a
 * cache creates in this, and register the cache's own reset with `onDispose`.
 */
export function own<T extends BufferGeometry | Material | Texture>(resource: T): T {
  owned.add(resource);
  return resource;
}

/**
 * Register a function that empties a module-level cache. It runs on every `disposeOwned()`,
 * so a cache never hands out a resource that has already been freed.
 */
export function onDispose(reset: () => void): void {
  resetters.add(reset);
}

export function disposeOwned(): void {
  for (const r of owned) r.dispose();
  owned.clear();
  for (const reset of resetters) reset();
}
