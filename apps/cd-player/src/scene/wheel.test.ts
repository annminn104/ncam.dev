import { describe, expect, it, vi } from 'vitest';
import {
  scrollsFirst,
  WHEEL_STREAM_MS,
  wheelFactor,
  wheelStep,
  type Scroller,
  type WheelInput,
} from './wheel';
import { ZOOM_STEP } from './zoom';

const PIXELS = 0;
const LINES = 1;
const PAGES = 2;

describe('wheelFactor', () => {
  it('zooms one step for a mouse wheel’s notch: 100 px, 120 px, three lines or a page', () => {
    // Up, a negative delta, zooms in.
    expect(wheelFactor(-100, PIXELS)).toBe(ZOOM_STEP);
    expect(wheelFactor(100, PIXELS)).toBe(1 / ZOOM_STEP);
    expect(wheelFactor(120, PIXELS)).toBe(1 / ZOOM_STEP);
    expect(wheelFactor(-3, LINES)).toBe(ZOOM_STEP);
    expect(wheelFactor(1, PAGES)).toBe(1 / ZOOM_STEP);
  });

  it('zooms one step for a macOS mouse notch, a tenth of a line at 40 px a line', () => {
    expect(wheelFactor(-4.000244140625, PIXELS)).toBe(ZOOM_STEP);
    expect(wheelFactor(8.00048828125, PIXELS)).toBe(1 / ZOOM_STEP);
    // A trackpad's whole pixels are not that notch.
    expect(wheelFactor(-4, PIXELS)).toBeCloseTo(Math.exp(0.04), 12);
  });

  it('follows a trackpad pinch’s fingers: Chrome sends their scale as −100·ln(scale)', () => {
    for (const scale of [1.02, 1.1, 0.95, 0.9]) {
      expect(wheelFactor(-100 * Math.log(scale), PIXELS)).toBeCloseTo(scale, 12);
    }
  });

  it('never goes more than a step in one event, and nowhere for no delta', () => {
    expect(wheelFactor(-1000, PIXELS)).toBe(ZOOM_STEP);
    expect(wheelFactor(400, LINES)).toBe(1 / ZOOM_STEP);
    expect(wheelFactor(0, PIXELS)).toBe(1);
  });
});

describe('scrollsFirst', () => {
  const box = (over: Partial<Scroller>): Scroller => ({
    overflowY: 'auto',
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 600,
    ...over,
  });

  it('leaves a plain wheel to a box that scrolls and has room that way', () => {
    expect(scrollsFirst([box({})], 100)).toBe(true);
    expect(scrollsFirst([box({ scrollTop: 200 })], -100)).toBe(true);
    expect(scrollsFirst([box({ overflowY: 'scroll', scrollTop: 399 })], 1)).toBe(true);
  });

  it('zooms where nothing can scroll that way: at the end, at the top, or not overflowing', () => {
    expect(scrollsFirst([box({ scrollTop: 400 })], 100)).toBe(false);
    expect(scrollsFirst([box({ scrollTop: 0 })], -100)).toBe(false);
    expect(scrollsFirst([box({ scrollHeight: 600 })], 100)).toBe(false);
    // A rounded scroll position at the end is the end.
    expect(scrollsFirst([box({ scrollTop: 399.5 })], 100)).toBe(false);
    expect(scrollsFirst([], 100)).toBe(false);
  });

  it('counts only a box the visitor can scroll: never one that hides or clips its overflow', () => {
    for (const overflowY of ['hidden', 'clip', 'visible']) {
      expect(scrollsFirst([box({ overflowY })], 100), overflowY).toBe(false);
    }
  });

  it('asks every box up the page: any one with room scrolls first', () => {
    const stuck = box({ scrollTop: 400 });
    expect(scrollsFirst([stuck, box({ overflowY: 'hidden' }), box({})], 100)).toBe(true);
  });
});

describe('wheelStep', () => {
  /** A plain wheel up or down (deltaY) at `at` ms. */
  const plain = (at: number, deltaY = -100, deltaX = 0): WheelInput => ({
    deltaX,
    deltaY,
    zoomKey: false,
    at,
  });
  const pinch = (at: number): WheelInput => ({ deltaX: 0, deltaY: -3, zoomKey: true, at });

  it('starts a plain stream by asking the page: scroll where it can that way, else zoom', () => {
    expect(wheelStep(null, plain(0), () => true)).toEqual({
      zooms: false,
      stream: { zooms: false, at: 0 },
    });
    expect(wheelStep(null, plain(0), () => false)).toEqual({
      zooms: true,
      stream: { zooms: true, at: 0 },
    });
  });

  it('keeps yielding through the stream: momentum past the page’s end still scrolls, never zooms', () => {
    let { stream } = wheelStep(null, plain(0), () => true);
    // The page has reached its top; a flick's momentum keeps coming, 16 ms apart.
    const atTheTop = vi.fn(() => false);
    for (let at = 16; at < 1000; at += 16) {
      const step = wheelStep(stream, plain(at), atTheTop);
      expect(step.zooms, `${at} ms`).toBe(false);
      stream = step.stream;
    }
    expect(atTheTop).not.toHaveBeenCalled();
  });

  it('decides anew after a gap: a new stream at the top zooms', () => {
    const { stream } = wheelStep(null, plain(0), () => true);
    expect(wheelStep(stream, plain(WHEEL_STREAM_MS - 1), () => false).zooms).toBe(false);
    expect(wheelStep(stream, plain(WHEEL_STREAM_MS), () => false).zooms).toBe(true);
    expect(wheelStep(stream, plain(2000), () => false).zooms).toBe(true);
  });

  it('keeps a stream that zoomed zooming, though the page could scroll by then', () => {
    let { stream } = wheelStep(null, plain(0), () => false);
    for (let at = 100; at < 1000; at += 100) {
      const step = wheelStep(stream, plain(at, 100), () => true);
      expect(step.zooms, `${at} ms`).toBe(true);
      stream = step.stream;
    }
  });

  it('always zooms with Ctrl or ⌘, or a trackpad’s pinch, and the stream zooms on', () => {
    const { stream } = wheelStep(null, plain(0), () => true);
    const pinched = wheelStep(stream, pinch(16), () => true);
    expect(pinched).toEqual({ zooms: true, stream: { zooms: true, at: 16 } });
    expect(wheelStep(pinched.stream, plain(32), () => true).zooms).toBe(true);
  });

  it('leaves a plain wheel that goes more sideways than up or down to the page, and the stream be', () => {
    const { stream } = wheelStep(null, plain(0), () => false);
    for (const [deltaX, deltaY] of [
      [30, 5],
      [-30, -29],
      [12, 0],
      [0, 0],
    ]) {
      const step = wheelStep(stream, plain(16, deltaY, deltaX), () => false);
      expect(step, `${deltaX}, ${deltaY}`).toEqual({ zooms: false, stream });
    }
    // Ctrl's or a pinch's goes on zooming, whichever way it leans.
    expect(
      wheelStep(stream, { deltaX: 30, deltaY: 5, zoomKey: true, at: 16 }, () => true).zooms,
    ).toBe(true);
  });
});
