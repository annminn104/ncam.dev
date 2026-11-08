import { ZOOM_STEP } from './zoom';

/**
 * A wheel over the canvas (src/scene/CameraRig.tsx): how far it zooms, and whether the page scrolls
 * instead. Where the page can scroll the wheel's way a plain wheel scrolls it, and only Ctrl or ⌘
 * with the wheel, or a trackpad's pinch (which browsers send as a wheel with ctrlKey), zooms.
 */

/** A wheel that scrolls by lines (Firefox) turns three a notch: a notch is then 100 px. */
const LINE_PX = 100 / 3;
/** A wheel that scrolls by pages. */
const PAGE_PX = 800;
/** A mouse wheel's notch on macOS (Chrome, Safari): a tenth of a line at 40 px a line. */
const MAC_NOTCH_PX = 4.000244140625;
/**
 * How much a pixel of wheel zooms: Chrome sends a trackpad pinch as ctrl-wheel deltas of
 * −100·ln(scale), so a pinch zooms as far as the fingers spread.
 */
const ZOOM_PER_PX = 0.01;

/**
 * The zoom factor of one wheel event: up (a negative delta) zooms in. One event goes a step at
 * most, which is a mouse wheel's notch (100 or 120 px, three lines, macOS's 4 px); a trackpad's
 * small deltas zoom smoothly.
 */
export function wheelFactor(deltaY: number, deltaMode: number): number {
  if (deltaY === 0) return 1;
  const px = deltaY * (deltaMode === 1 ? LINE_PX : deltaMode === 2 ? PAGE_PX : 1);
  if (Math.abs(px) % MAC_NOTCH_PX === 0) return px < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
  return Math.min(ZOOM_STEP, Math.max(1 / ZOOM_STEP, Math.exp(-px * ZOOM_PER_PX)));
}

/** Wheel events closer together than this (ms) are one stream: notches in a row, a flick's tail. */
export const WHEEL_STREAM_MS = 250;

/** A stream of wheel events: whether it zooms, and when its latest event came (ms). */
export interface WheelStream {
  zooms: boolean;
  at: number;
}

/** One wheel event over the canvas, as wheelStep reads it. */
export interface WheelInput {
  deltaX: number;
  deltaY: number;
  /** Ctrl or ⌘ held, or a trackpad's pinch, which browsers send with ctrlKey. */
  zoomKey: boolean;
  /** When it came (ms: the event's timeStamp). */
  at: number;
}

/**
 * Whether one wheel event zooms (and keeps the page from scrolling with it), and the stream it
 * leaves. Ctrl, ⌘ or a pinch always zooms, and the stream zooms on. A plain wheel that goes more
 * sideways than up or down (a diagonal swipe), or nowhere, is the page's, and leaves the stream be.
 * Otherwise a stream keeps its first choice: one that yielded to the page keeps yielding, so a
 * flick's momentum that carries on past the page's end never turns into a zoom, and one that
 * zoomed keeps zooming. A fresh stream asks `pageScrolls` (scrollsFirst): the page's if it can
 * scroll that way, else a zoom.
 */
export function wheelStep(
  stream: WheelStream | null,
  { deltaX, deltaY, zoomKey, at }: WheelInput,
  pageScrolls: () => boolean,
): { zooms: boolean; stream: WheelStream | null } {
  if (zoomKey) return { zooms: true, stream: { zooms: true, at } };
  if (Math.abs(deltaX) > Math.abs(deltaY) || deltaY === 0) return { zooms: false, stream };
  const zooms = stream && at - stream.at < WHEEL_STREAM_MS ? stream.zooms : !pageScrolls();
  return { zooms, stream: { zooms, at } };
}

/** A box between the canvas and the page's top: how it handles overflow and how far it scrolls. */
export interface Scroller {
  overflowY: string;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

const SCROLLS = new Set(['auto', 'scroll', 'overlay']);

/**
 * Whether a plain wheel `deltaY` scrolls one of these instead of zooming: one the visitor can
 * scroll, with a pixel or more of room that way (a rounded position at the end is the end).
 */
export function scrollsFirst(scrollers: readonly Scroller[], deltaY: number): boolean {
  return scrollers.some(({ overflowY, scrollTop, scrollHeight, clientHeight }) => {
    if (!SCROLLS.has(overflowY)) return false;
    if (deltaY > 0) return scrollHeight - clientHeight - scrollTop >= 1;
    return deltaY < 0 && scrollTop >= 1;
  });
}

/**
 * The canvas's ancestors, then the page's own scroller, which scrolls unless the root or the body
 * hides or clips its overflow (the phone layout's page scrolls; the sideways one's root does).
 */
export function scrollersOf(element: Element): Scroller[] {
  const doc = element.ownerDocument;
  const view = doc.defaultView;
  if (!view) return [];
  const page = doc.scrollingElement ?? doc.documentElement;
  const out: Scroller[] = [];
  for (let node = element.parentElement; node && node !== page; node = node.parentElement) {
    const { scrollTop, scrollHeight, clientHeight } = node;
    out.push({
      overflowY: view.getComputedStyle(node).overflowY,
      scrollTop,
      scrollHeight,
      clientHeight,
    });
  }
  const held = [doc.documentElement, doc.body].some(
    (node) => node && /^(hidden|clip)$/.test(view.getComputedStyle(node).overflowY),
  );
  const { scrollTop, scrollHeight, clientHeight } = page;
  out.push({ overflowY: held ? 'hidden' : 'auto', scrollTop, scrollHeight, clientHeight });
  return out;
}
