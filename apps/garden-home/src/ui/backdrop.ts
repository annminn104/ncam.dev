import { type CSSProperties, useEffect, useState } from 'react';

/** The ?bg= image: none asked for, on its way, decoded and shown, or unusable (missing, not an image). */
export type BackdropState = 'none' | 'loading' | 'ready' | 'failed';

/** CSS for the element behind the transparent canvas: the image covers the screen, centred. */
export function backdropStyle(url: string): CSSProperties {
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

/**
 * The sky dome and fog stay until the image has decoded: while it loads the canvas is not left transparent over the
 * page's navy, which would flash. A failed image keeps them for good.
 */
export function showsSky(state: BackdropState): boolean {
  return state !== 'ready';
}

/** Loads the ?bg= image once, so a missing file can fall back to the sky. */
export function useBackdrop(url: string | null): BackdropState {
  const [state, setState] = useState<BackdropState>(url ? 'loading' : 'none');
  useEffect(() => {
    if (!url) return;
    let live = true;
    const image = new Image();
    image.src = url;
    image.decode().then(
      () => live && setState('ready'),
      () => live && setState('failed'),
    );
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}
