/**
 * Holds the scene's release until R3F has unmounted the tree that uses what it frees. R3F commits
 * a Canvas's unmount a tick after React's root.unmount(), and until then its components still
 * re-render on store changes, so releasing at once refetches the modules into a fresh KTX2 pool.
 */
export interface ReleaseGate {
  /** A scene's tree mounted; the function returned is its unmount. */
  mount(): () => void;
  /** The mount's disposer asks for the release: now if no scene is mounted, else once the scenes mounted now have all unmounted. */
  request(): void;
}

export function createReleaseGate(
  release: () => void,
  defer: (run: () => void) => void = queueMicrotask,
): ReleaseGate {
  const live = new Set<symbol>();
  let waiting: Set<symbol> | null = null;
  return {
    mount() {
      const token = Symbol('scene');
      live.add(token);
      return () => {
        live.delete(token);
        if (!waiting?.delete(token) || waiting.size > 0) return;
        waiting = null;
        // A scene mounted since the request shares the caches: it owns them now, and its own disposer releases them.
        defer(() => {
          if (live.size > 0) return;
          // Runs on its own tick, outside any caller's try/catch: a throw would surface uncaught.
          try {
            release();
          } catch (error) {
            console.warn('[garden-home] a release failed', error);
          }
        });
      };
    },
    request() {
      if (live.size === 0) release();
      else waiting = new Set(live);
    },
  };
}
