// Spotify's image CDN answers with Access-Control-Allow-Origin: *, so its images can be textures.

/** How many images the cache keeps: a long playlist would otherwise hold every cover it played. */
export const IMAGE_CACHE_LIMIT = 24;

/** The images by address, the least recently used first. */
const cache = new Map<string, Promise<HTMLImageElement>>();

/**
 * The image at `url`, loaded once while it is among the last IMAGE_CACHE_LIMIT used. A load that
 * fails is not kept.
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = cache.get(url);
  if (cached) {
    // A use is the most recent one: the entry moves to the back, which eviction reaches last.
    cache.delete(url);
    cache.set(url, cached);
    return cached;
  }
  const pending: Promise<HTMLImageElement> = new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => {
      // Not another load's entry: this one may have been evicted and the address asked for again.
      if (cache.get(url) === pending) cache.delete(url);
      reject(new Error(`could not load ${url}`));
    };
    image.src = url;
  });
  cache.set(url, pending);
  for (const key of cache.keys()) {
    if (cache.size <= IMAGE_CACHE_LIMIT) break;
    cache.delete(key);
  }
  return pending;
}

/** The image, or null when there is no URL or it fails: the painters print their default then. */
export async function tryImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    return await loadImage(url);
  } catch {
    return null;
  }
}
