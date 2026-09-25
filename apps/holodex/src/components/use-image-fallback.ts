import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';

/**
 * Every image URL this page has shown. One shown before shows again at once,
 * with no placeholder or fade: an effects tile going live mounts a new image of
 * the art it already showed, and used to blink through a placeholder first.
 */
const shown = new Set<string>();

/** Record an image URL as shown (useImageFallback does, on load). */
export function rememberShown(url: string): void {
  shown.add(url);
}

export interface ImageFallback {
  /** The file to show now; undefined once every one has failed, or when there were none. */
  src: string | undefined;
  /** Whether `src` has finished loading: the moment to fade it in over its placeholder. */
  loaded: boolean;
  ref: RefObject<HTMLImageElement | null>;
  onLoad: () => void;
  onError: () => void;
}

/**
 * Walks `urls` in order: a file that fails to load moves on to the next, and
 * once they have all failed `src` is undefined, for the caller's own fallback.
 * Counted against the whole list, so a new list (another card, another
 * quality) starts again at its first. An image that loaded or failed before
 * hydration fired its event unheard, so mounting reads the element's state.
 */
export function useImageFallback(urls: readonly string[]): ImageFallback {
  const key = urls.join(' ');
  const [state, setState] = useState({ key, failures: 0, loaded: '' });
  const failures = state.key === key ? state.failures : 0;
  const src = urls[failures];
  const loaded =
    src !== undefined && (shown.has(src) || (state.key === key && state.loaded === src));
  const ref = useRef<HTMLImageElement>(null);

  const onError = () =>
    setState((prev) => ({ key, failures: (prev.key === key ? prev.failures : 0) + 1, loaded: '' }));
  const onLoad = () => {
    if (src) rememberShown(src);
    setState((prev) => ({
      key,
      failures: prev.key === key ? prev.failures : 0,
      loaded: src ?? '',
    }));
  };

  const settle = useEffectEvent(() => {
    const image = ref.current;
    if (!image?.complete) return;
    if (image.naturalWidth === 0) onError();
    else onLoad();
  });
  useEffect(() => settle(), [src]);

  return { src, loaded, ref, onLoad, onError };
}
