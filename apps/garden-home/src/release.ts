// What the lazy scene chunk keeps at module level (loader caches, the KTX2 transcoder's workers,
// the store) outlives React's unmount. The chunk registers its release here when it loads; the
// mount's disposer calls releaseAll() after the root unmounts, so coming back starts clean. No
// imports: the SSR-safe entries call it.

const releases = new Set<() => void>();

export function onRelease(release: () => void): void {
  releases.add(release);
}

export function releaseAll(): void {
  for (const release of releases) {
    try {
      release();
    } catch (error) {
      console.warn('[garden-home] a release failed', error);
    }
  }
}
