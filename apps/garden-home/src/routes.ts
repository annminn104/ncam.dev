import { parseCapture } from './capture';
import type { Route } from './runtime';

/**
 * What the standalone page shows: the poster capture (?capture=), the wallpaper (…/wallpaper, for
 * Plash: no input, boots at once) or the site. The federated mount is always the site.
 */
export function standaloneView(pathname: string, search: string): 'capture' | Route {
  if (parseCapture(search)) return 'capture';
  const path = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return path === '/wallpaper' || path.endsWith('/wallpaper') ? 'wallpaper' : 'site';
}
