/**
 * Resolve one of this remote's own files. The host and the remote can live on
 * different origins, so never resolve against the page: use the base the host
 * sent (MountConfig.assetBase) or the one derived from this module's URL.
 */
export function assetUrl(path: string, base: string): string {
  const clean = path.replace(/^\/+/, '');
  if (!base) return `/${clean}`;
  const withSlash = base.endsWith('/') ? base : `${base}/`;
  return new URL(clean, withSlash).href;
}

/** The base to resolve against: the host's assetBase, else this bundle's own. */
export function remoteBase(assetBase?: string): string {
  if (assetBase) return assetBase;
  try {
    return new URL(import.meta.env.BASE_URL, import.meta.url).href;
  } catch {
    return '';
  }
}
