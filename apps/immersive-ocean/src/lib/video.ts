import { useEffect, type RefObject } from 'react';

/** What counts as the visitor being here: any of these, the first one. */
const INTERACTION_EVENTS = [
  'pointermove',
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const;

/**
 * Starts a muted, looping background video on the visitor's first interaction
 * (a mouse move is enough), over its poster, the video's first frame, until
 * then. The markup carries `preload="none"` and no `autoPlay`: playing with
 * the page, the stream shared the network with the first screen, and the
 * video kept the screen changing from the first second, which is what Speed
 * Index measures. Under `prefers-reduced-motion: reduce` it never starts on
 * its own; a refused play() (data saver, say) leaves the poster.
 */
export function usePlayOnInteraction(ref: RefObject<HTMLVideoElement | null>): void {
  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const controller = new AbortController();
    const start = () => {
      controller.abort();
      void video.play().catch(() => undefined);
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
