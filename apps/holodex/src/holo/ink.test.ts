import { describe, expect, it } from 'vitest';
import { findInk, paintInk, type Pixels } from './ink';

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

  it('finds a trainer’s name, black on its light panel with no outline of its own, i dots and all', () => {
    // the panel is light enough to be an outline all round the letters
    const pixels = strip(80, 30, 215, [
      [20, 10, 5, 16, 0],
      // an i: its stem, and its dot, 5 px tall, 3 px above it
      [40, 12, 5, 14, 0],
      [40, 4, 5, 5, 0],
    ]);
    const ink = findInk(pixels);
    expect(at(ink, 80, 22, 18)).toBe(255);
    expect(at(ink, 80, 42, 6)).toBe(255);
    expect(at(ink, 80, 60, 18)).toBe(0);
  });

  it('reads a stage tab’s grey letters in their white outline, told how light its ink runs', () => {
    // the plate, as grey as the letters nearly, runs off the strip's edges
    const pixels = strip(
      80,
      30,
      140,
      letter(20, 5, 6, 16).map(([x, y, w, h, grey]) =>
        grey === 0 ? [x, y, w, h, 110] : [x, y, w, h, 235],
      ),
    );
    expect(findInk(pixels).every((v) => v === 0)).toBe(true);
    const ink = findInk(pixels, 1, { dark: 180 });
    expect(at(ink, 80, 25, 15)).toBe(255);
    expect(at(ink, 80, 5, 15)).toBe(0);
    expect(at(ink, 80, 60, 15)).toBe(0);
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

describe('paintInk', () => {
  it('inks the ellipse a box holds, and none of the box’s corners', () => {
    const ink = new Uint8Array(40 * 30);
    paintInk(ink, 40, { x0: 10, y0: 5, w: 20, h: 16 });
    expect(at(ink, 40, 20, 13)).toBe(255);
    expect(at(ink, 40, 11, 6)).toBe(0);
    expect(at(ink, 40, 5, 13)).toBe(0);
  });

  it('leaves a ring’s hole bare, the ink its rim alone', () => {
    const ink = new Uint8Array(40 * 30);
    paintInk(ink, 40, { x0: 10, y0: 5, w: 20, h: 16 }, 0.8);
    expect(at(ink, 40, 20, 13)).toBe(0);
    expect(at(ink, 40, 10, 13)).toBe(255);
    expect(at(ink, 40, 20, 5)).toBe(255);
  });

  it('stays within the mask where the box runs off it', () => {
    const ink = new Uint8Array(20 * 10);
    expect(() => paintInk(ink, 20, { x0: 15, y0: 5, w: 20, h: 16 })).not.toThrow();
    expect(ink.length).toBe(200);
  });
});
