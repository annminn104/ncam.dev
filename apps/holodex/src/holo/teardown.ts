/**
 * Three-free indirection onto the holo shader cache's disposer.
 *
 * mount.tsx and hydrate.tsx need to free that cache on every remote
 * teardown, but importing program-cache.ts to reach it — even dynamically —
 * pulls in the three.js symbols program-cache.ts imports, which Rollup bakes
 * into the same chunk scene.ts's three.js usage lives in. A visitor who only
 * ever saw the grid or list view never loaded a HoloCard, so that chunk was
 * never fetched — and it should stay that way on the way out too.
 *
 * program-cache.ts registers its own disposeMaterials here, at module scope,
 * the moment it is first loaded (via HoloCard's dynamic import('./scene')).
 * Until that has happened, `dispose` is null and disposeHoloCache() is a
 * no-op: there is nothing cached, so there is nothing to free, and nothing
 * to download to find that out.
 */
let dispose: (() => void) | null = null;

export function registerCacheDispose(fn: () => void): void {
  dispose = fn;
}

/** No-op until a HoloCard has actually loaded the cache this frees. */
export function disposeHoloCache(): void {
  dispose?.();
}
