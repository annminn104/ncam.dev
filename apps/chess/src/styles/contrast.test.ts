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

  it('keeps the arena captions readable over any preview, even a white one', () => {
    // The caption's own scrim: transparent, then from the top of the text (its padding-top, where
    // the fade ends) down at least `from` black, darkening to `to`. The worst preview behind it is
    // white; the name is --chess-ink, the lore that ink at its own alpha over the scrimmed white.
    const block = /\.chess-arena__caption\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const scrim =
      /padding-top:\s*([\d.]+rem);[\s\S]*?linear-gradient\(\s*180deg\s*,\s*transparent\s*,\s*rgb\(0 0 0 \/ ([\d.]+)\)\s*([\d.]+rem)\s*,\s*rgb\(0 0 0 \/ ([\d.]+)\)\s*\)/.exec(
        block,
      );
    if (!scrim) throw new Error('the .chess-arena__caption scrim was not found in globals.css');
    expect(scrim[3], 'the scrim is solid from where its fade ends: the top of the text').toBe(
      scrim[1],
    );
    const lore = /\.chess-arena__lore\s*\{[^}]*?color:\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/.exec(
      css,
    );
    if (!lore) throw new Error('the .chess-arena__lore colour was not found in globals.css');
    const loreInk = [Number(lore[1]), Number(lore[2]), Number(lore[3])] as Rgb;
    const loreAlpha = Number(lore[4]);
    for (const alpha of [Number(scrim[2]), Number(scrim[4])]) {
      const bg = [0, 0, 0].map(() => Math.round(255 * (1 - alpha))) as Rgb;
      const loreOnBg = loreInk.map((c, i) => Math.round(c * loreAlpha + bg[i] * (1 - loreAlpha)));
      expect(contrast(token('ink'), bg), `name over white under ${alpha}`).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrast(loreOnBg as Rgb, bg),
        `lore over white under ${alpha}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the piece-set captions readable over any preview, even a white one', () => {
    // The arena caption's scrim again: a fade as tall as the padding above the text, then from
    // the top of the text down at least `from` black, so the name and the tagline hold 4.5:1
    // however many lines the card's width wraps them to. Worst preview behind it: white.
    const block = /\.chess-preset__caption\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const scrim =
      /padding:\s*([\d.]+rem)\s[^;]*;[\s\S]*?linear-gradient\(\s*180deg\s*,\s*transparent\s*,\s*rgb\(0 0 0 \/ ([\d.]+)\)\s*([\d.]+rem)\s*,\s*rgb\(0 0 0 \/ ([\d.]+)\)\s*\)/.exec(
        block,
      );
    if (!scrim) throw new Error('the .chess-preset__caption scrim was not found in globals.css');
    expect(scrim[3], 'the scrim is solid from where its fade ends: the top of the text').toBe(
      scrim[1],
    );
    const tagline =
      /\.chess-preset__tagline\s*\{[^}]*?color:\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/.exec(css);
    if (!tagline) throw new Error('the .chess-preset__tagline colour was not found in globals.css');
    const taglineInk = [Number(tagline[1]), Number(tagline[2]), Number(tagline[3])] as Rgb;
    const taglineAlpha = Number(tagline[4]);
    for (const alpha of [Number(scrim[2]), Number(scrim[4])]) {
      const bg = [0, 0, 0].map(() => Math.round(255 * (1 - alpha))) as Rgb;
      const taglineOnBg = taglineInk.map((c, i) =>
        Math.round(c * taglineAlpha + bg[i] * (1 - taglineAlpha)),
      );
      expect(contrast(token('ink'), bg), `name over white under ${alpha}`).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrast(taglineOnBg as Rgb, bg),
        `tagline over white under ${alpha}`,
      ).toBeGreaterThanOrEqual(4.5);
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
