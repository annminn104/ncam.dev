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

/**
 * Frees every owned resource, then empties every cache. One that throws stops nothing: the rest
 * are freed and every cache emptied all the same (a cache left full would hand the next battle a
 * freed resource), and only then is the failure thrown, an AggregateError if there were several.
 */
export function disposeOwned(): void {
  const errors: unknown[] = [];
  const attempt = (step: () => void) => {
    try {
      step();
    } catch (e) {
      errors.push(e);
    }
  };
  const freeing = [...owned];
  owned.clear();
  for (const r of freeing) attempt(() => r.dispose());
  for (const reset of resetters) attempt(reset);
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'disposeOwned: several disposals failed');
}
