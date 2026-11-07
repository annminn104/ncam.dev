import { readFileSync } from 'node:fs';

const HEX = /^#[0-9a-f]{6}$/;

/** An sRGB colour's channels, 0 to 255, unrounded. */
export type Rgb = readonly [number, number, number];
export const WHITE: Rgb = [255, 255, 255];
export const BLACK: Rgb = [0, 0, 0];

export function rgb(hex: string): Rgb {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as unknown as Rgb;
}

/** `color-mix(in srgb, a share, b)`, and a colour at an alpha of `share` over b alike. */
export function mix(a: Rgb, share: number, b: Rgb): Rgb {
  return a.map((c, i) => c * share + b[i] * (1 - share)) as unknown as Rgb;
}

/** The accent's ink, --cdp-accent-ink: `color-mix(in srgb, accent 50%, black)`. */
export const inkOf = (accent: Rgb) => mix(accent, 0.5, BLACK);

/** WCAG 2's relative luminance of an sRGB colour. */
export function luminance(colour: Rgb): number {
  const [r, g, b] = colour.map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2's contrast ratio of two sRGB colours, the lighter over the darker. */
export function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const css = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8');

/** A colour token of .cdp-root in src/styles/app.css: `#rrggbb`, or `rgb(r g b)` with an alpha. */
export function cssToken(name: string): { colour: Rgb; alpha: number } {
  const value = new RegExp(`--cdp-${name}:\\s*([^;]+);`).exec(css)?.[1].trim() ?? '';
  if (HEX.test(value)) return { colour: rgb(value), alpha: 1 };
  const parts = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(value);
  if (!parts) throw new Error(`--cdp-${name} is not a colour this test reads: ${value}`);
  const [, r, g, b, alpha] = parts;
  return { colour: [Number(r), Number(g), Number(b)], alpha: alpha ? Number(alpha) : 1 };
}

/** A number the stylesheet writes, found by `pattern`'s one group. */
export function cssNumber(pattern: RegExp): number {
  const value = Number(pattern.exec(css)?.[1]);
  if (!Number.isFinite(value)) throw new Error(`not in src/styles/app.css: ${String(pattern)}`);
  return value;
}
