/**
 * Conversion between the host router's splat params and the route string a
 * route-aware remote understands (see packages/mf-remote/src/contract.ts).
 *
 * The remote never sees `/projects/<id>` — it only knows its own paths, so it
 * can be developed and deployed standalone on its own origin.
 */

/** Build the remote-relative route from a splat route's params. */
export function toRemoteRoute(splat: string | undefined, searchStr: string): string {
  const path = (splat ?? '').replace(/^\/+/, '').replace(/\/+$/, '');
  const query = searchStr.startsWith('?') ? searchStr.slice(1) : searchStr;
  return `/${path}${query ? `?${query}` : ''}`;
}

/** Split a remote-relative path into the params the host router needs. */
export function fromRemoteRoute(to: string): { splat: string; search: Record<string, string> } {
  const [rawPath = '', query = ''] = to.split('?');
  return {
    splat: rawPath.replace(/^\/+/, '').replace(/\/+$/, ''),
    search: Object.fromEntries(new URLSearchParams(query)),
  };
}
