/**
 * The host ↔ remote mounting contract.
 *
 * Types only, on purpose: nothing here compiles to runtime code, so a remote
 * that imports it adds nothing to its bundle and the `shared: {}` model is
 * untouched.
 *
 * Backward compatible by construction — every field is optional, so the
 * existing remotes (which take no config and return a bare disposer) already
 * satisfy it.
 */

export interface MountConfig {
  /**
   * Path inside the remote, always leading-slash, optionally with a query
   * string, e.g. `/sets/swsh3?type=Fire`. The remote's own root is `/`.
   */
  route?: string;
  /**
   * Ask the host to navigate. `to` is remote-relative, in the same shape as
   * `route`. A remote running standalone supplies its own implementation.
   */
  onNavigate?: (to: string) => void;
  /** Origin to resolve the remote's own assets against. */
  assetBase?: string;
}

/**
 * What a remote's `mount` / `hydrate` returns: a disposer, which may also
 * accept a new route so the host can navigate without tearing the remote down
 * (and losing its WebGL context, query cache and scroll position).
 */
export interface MountHandle {
  (): void;
  update?: (route: string) => void;
}
