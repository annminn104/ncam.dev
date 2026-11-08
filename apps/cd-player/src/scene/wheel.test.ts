import { describe, expect, it } from 'vitest';
import { scrollsFirst, wheelFactor, type Scroller } from './wheel';
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
