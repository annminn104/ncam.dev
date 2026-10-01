import { describe, expect, it } from 'vitest';
import css from './globals.css?inline';

// WCAG 2.x contrast. The lobby's text is below the "large text" size, so 4.5:1 applies.
type Rgb = [number, number, number];

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hex = (value: string): Rgb => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (!m) throw new Error(`not a #rrggbb colour: ${value}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
};
const token = (name: string): Rgb => {
  const m = new RegExp(`--chess-${name}:\\s*(#[0-9a-f]{6})\\b`, 'i').exec(css);
  if (!m) throw new Error(`--chess-${name} is not a #rrggbb token in globals.css`);
  return hex(m[1]);
};

describe('lobby colour contrast (WCAG AA, 4.5:1)', () => {
  it('keeps the text tokens readable on the page background', () => {
    const bg = token('bg');
    for (const name of ['ink', 'muted', 'gold']) {
      expect(contrast(token(name), bg), `--chess-${name} on --chess-bg`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('keeps the "Enter battle" label readable along its whole gradient', () => {
    const m =
      /\.chess-start\s*\{[^}]*?linear-gradient\(\s*135deg\s*,\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)/i.exec(
        css,
      );
    if (!m) throw new Error('the .chess-start gradient was not found in globals.css');
    const from = hex(m[1]);
    const to = hex(m[2]);
    const ink = token('ink');
    for (let step = 0; step <= 10; step++) {
      const t = step / 10;
      const stop = from.map((c, i) => Math.round(c + (to[i] - c) * t)) as Rgb;
      expect(contrast(ink, stop), `gradient at ${step * 10}%`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
