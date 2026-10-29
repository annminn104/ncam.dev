/** Spotify's image CDN answers with Access-Control-Allow-Origin: *, so its images can be textures. */
const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let pending = cache.get(url);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => {
        cache.delete(url);
        reject(new Error(`could not load ${url}`));
      };
      image.src = url;
    });
    cache.set(url, pending);
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
