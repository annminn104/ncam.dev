import { useEffect, type RefObject } from 'react';

/**
 * The page's background videos load on a schedule instead of all at once with
 * the page: each is megabytes (the hero's alone is 22 MB), and autoplaying
 * them together left a phone's first screen waiting on streams it could not
 * show yet. The markup carries `preload="none"` and no `autoPlay`; these hooks
 * start each video when it is wanted: the hero's on the first interaction,
 * the rest as the visitor scrolls near them.
 */

/** Plays a muted, looping video; a refusal (data saver, say) leaves its poster. */
export function play(video: HTMLVideoElement): void {
  video.play().catch(() => undefined);
}

/** What counts as the visitor being here: any of these, the first one. */
export const INTERACTION_EVENTS = [
  'pointermove',
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const;

/**
 * Starts the video on the visitor's first interaction (a mouse move is enough),
 * over its poster, the video's first frame, until then. Not with the page: the
 * stream would share the network with the first screen, and a video playing
 * from the first second keeps the screen changing for as long as it runs,
 * which is what Speed Index measures. Under `prefers-reduced-motion: reduce`
 * it never starts on its own.
 */
export function usePlayOnInteraction(ref: RefObject<HTMLVideoElement | null>): void {
  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const controller = new AbortController();
    const start = () => {
      controller.abort();
      play(video);
    };
    for (const type of INTERACTION_EVENTS) {
      window.addEventListener(type, start, {
        once: true,
        passive: true,
        signal: controller.signal,
      });
    }
    return () => controller.abort();
  }, [ref]);
}

/**
 * Runs `start` once the element comes within a quarter screen of the viewport, and the
 * cleanup it returns on unmount. `start` should be stable (module-level or
 * memoised): a new one restarts the watch.
 */
export function useWhenNear<E extends Element>(
  ref: RefObject<E | null>,
  start: (element: E) => void | (() => void),
): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let cleanup: void | (() => void);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        cleanup = start(element);
      },
      // A quarter screen ahead: enough to start buffering before it shows, not
      // so much that the one just below the hero starts with the page.
      { rootMargin: '25% 0px' },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cleanup?.();
    };
  }, [ref, start]);
}
