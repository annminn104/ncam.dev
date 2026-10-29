import { describe, expect, it } from 'vitest';
import { arcLayout, coverCrop, fitText, lcdDigits, segmentRects, SEGMENTS } from './layout';

describe('texture layout', () => {
  it('cover-crops to the box', () => {
    expect(coverCrop(1000, 500, 100, 100)).toEqual({ sx: 250, sy: 0, sw: 500, sh: 500 });
    const tall = coverCrop(300, 600, 200, 100);
    expect(tall.sx).toBe(0);
    expect(tall.sw).toBeCloseTo(300);
    expect(tall.sh).toBeCloseTo(150);
    expect(tall.sy).toBeCloseTo(225);
  });

  it('centres glyphs on an arc', () => {
    const placed = arcLayout(['a', 'b'], [10, 10], 100);
    expect(placed.map((p) => p.char)).toEqual(['a', 'b']);
    expect(placed[0].angle).toBeCloseTo(-0.05);
    expect(placed[1].angle).toBeCloseTo(0.05);
  });

  it('fits text with an ellipsis', () => {
    const measure = (s: string) => s.length * 10;
    expect(fitText(measure, 'short', 100)).toBe('short');
    expect(fitText(measure, 'a much longer name', 100)).toBe('a much lo…');
  });

  it('lights seven segments per digit, and lays them inside the cell', () => {
    for (const digit of '0123456789') expect(SEGMENTS[digit].length).toBeGreaterThan(1);
    expect(SEGMENTS['8']).toBe('abcdefg');
    const rects = segmentRects(0, 0, 20, 40, 4);
    expect(rects.a[1]).toBe(0);
    expect(rects.d[1]).toBe(36);
    for (const [, , w, h] of Object.values(rects)) expect(w > 0 && h > 0).toBe(true);
  });

  it('formats the display', () => {
    expect(lcdDigits(0, 0)).toEqual({ track: '--', time: '-:--' });
    expect(lcdDigits(3, 84_000)).toEqual({ track: '03', time: '1:24' });
    expect(lcdDigits(12, 6_000_000)).toEqual({ track: '12', time: '99:00' });
  });
});
