import type { MountConfig } from '@ncam/mf-remote';

/**
 * Holds the current route outside React, so the host can push a new one
 * through `MountHandle.update()` without the remote being torn down and
 * rebuilt. `App` reads it with `useSyncExternalStore`.
 */
export interface RouteController {
  getRoute: () => string;
  setRoute: (route: string) => void;
  subscribe: (listener: () => void) => () => void;
  /**
   * Ask to go somewhere. Mounted in the host, the host owns the URL, so this
   * only asks — the route changes when the host calls `update()` back. Running
   * standalone, it updates the route directly.
   */
  navigate: (to: string) => void;
}

export function createRouteController(config: MountConfig = {}): RouteController {
  let route = config.route || '/';
  const listeners = new Set<() => void>();

  const setRoute = (next: string): void => {
    const value = next || '/';
    if (value === route) return;
    route = value;
    for (const listener of listeners) listener();
  };

  return {
    getRoute: () => route,
    setRoute,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    navigate: (to) => {
      if (config.onNavigate) config.onNavigate(to);
      else setRoute(to);
    },
  };
}
