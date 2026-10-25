import { useEffect, useRef, useState } from 'react';

/**
 * A preview <img> that hides itself when it fails, without a hydration mismatch: nothing is
 * marked on the first render; an error before hydration is caught by looking at the settled
 * image after mount, one after it by onError.
 */
export function usePreviewImage(src: string) {
  const ref = useRef<HTMLImageElement>(null);
  // The preview URL that failed to load. The card then shows its fallback gradient alone, without
  // the browser's broken-image icon painted over it.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  useEffect(() => {
    // The server-rendered <img> starts loading before React hydrates, so an `error` that fired
    // in between never reached onError. By now the image has settled: look at where it ended up.
    const el = ref.current;
    if (el?.complete && el.naturalWidth === 0) setFailedSrc(src);
  }, [src]);
  return { ref, failed: failedSrc === src, onError: () => setFailedSrc(src) };
}
