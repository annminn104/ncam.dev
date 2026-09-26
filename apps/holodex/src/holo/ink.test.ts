import { describe, expect, it } from 'vitest';
import { findInk, type Pixels } from './ink';

/** A strip of one grey, painted on with filled rects, [x, y, w, h, grey]. */
function strip(width: number, height: number, background: number, rects: number[][]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  const paint = (x0: number, y0: number, w: number, h: number, grey: number) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = grey;
        data[i + 3] = 255;
      }
    }
  };
  paint(0, 0, width, height, background);
  for (const [x, y, w, h, grey] of rects) paint(x, y, w, h, grey);
  return { data, width, height };
}

/** A letter's stem as the title strips print it: black, in a white outline 2 px wide. */
const letter = (x: number, y: number, w: number, h: number, s = 1) => [
  [x, y, w + 4 * s, h + 4 * s, 255],
  [x + 2 * s, y + 2 * s, w, h, 0],
];

const at = (mask: Uint8Array, width: number, x: number, y: number) => mask[y * width + x];

describe('findInk', () => {
  it('finds a black letter in its white outline on a mid-grey strip, the outline with it', () => {
    const pixels = strip(60, 30, 128, letter(20, 5, 6, 16));
    const ink = findInk(pixels);
    expect(at(ink, 60, 25, 15)).toBe(255);
    // the outline, which the ink grows over
    expect(at(ink, 60, 21, 15)).toBe(255);
    // the strip beside it
    expect(at(ink, 60, 5, 15)).toBe(0);
    expect(at(ink, 60, 45, 15)).toBe(0);
  });

  it('leaves a dark background alone, even with an outlined letter printed on it', () => {
    const pixels = strip(80, 30, 128, [[0, 0, 50, 30, 40], ...letter(20, 5, 6, 16)]);
    const ink = findInk(pixels);
    expect(at(ink, 80, 25, 15)).toBe(255);
    expect(at(ink, 80, 5, 15)).toBe(0);
    expect(at(ink, 80, 40, 25)).toBe(0);
  });

  it('ignores a dark blob with no white outline round it', () => {
    const pixels = strip(60, 30, 128, [[22, 7, 6, 16, 0]]);
    expect(findInk(pixels).every((v) => v === 0)).toBe(true);
  });

  it('ignores specks too small to be letters and blocks too big to be', () => {
    const speck = strip(60, 30, 128, letter(20, 10, 3, 3));
    expect(findInk(speck).every((v) => v === 0)).toBe(true);
    const block = strip(220, 40, 128, letter(10, 5, 170, 20));
    expect(findInk(block).every((v) => v === 0)).toBe(true);
  });

  it('measures its sizes against a 600 px wide scan, and scales them with the scan', () => {
    // twice the scan: the letter at twice the size is still one, the speck
    // at twice the size still too small
    const big = strip(120, 60, 128, letter(40, 10, 12, 32, 2));
    const ink = findInk(big, 2);
    expect(at(ink, 120, 50, 30)).toBe(255);
    const speck = strip(120, 60, 128, letter(40, 20, 6, 6, 2));
    expect(findInk(speck, 2).every((v) => v === 0)).toBe(true);
  });
});
