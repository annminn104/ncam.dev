import { describe, expect, it } from 'vitest';
import globals from '../styles/globals.css?inline';
import css from './battle.css?inline';

// WCAG 2.x contrast for the battle HUD. Its panels are translucent, so each check runs over both
// extremes an arena can put behind them: Cloud Peak's white sky and Blood Moon's black ground.
// Text needs 4.5:1 on its panel; a control's edge needs 3:1 against the panel around it.
type Rgb = [number, number, number];
type Rgba = [number, number, number, number];

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
const over = ([r, g, b, a]: Rgba, [br, bg, bb]: Rgb): Rgb => [
  r * a + br * (1 - a),
  g * a + bg * (1 - a),
  b * a + bb * (1 - a),
];

const hexToken = (sheet: string, name: string): Rgb => {
  const m = new RegExp(`--${name}:\\s*#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})\\b`, 'i').exec(
    sheet,
  );
  if (!m) throw new Error(`--${name} is not a #rrggbb token`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
};
const rgbaToken = (name: string): Rgba => {
  const m = new RegExp(`--${name}:\\s*rgb\\((\\d+) (\\d+) (\\d+) / ([\\d.]+)\\)`).exec(css);
  if (!m) throw new Error(`--${name} is not an rgb(r g b / a) token in battle.css`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
};
const modalFill = (): Rgba => {
  const m = /\.chess-modal\s*\{[^}]*?background:\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/.exec(css);
  if (!m) throw new Error('the .chess-modal background was not found in battle.css');
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
};

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const surfaces = [
  ['HUD panel', rgbaToken('hud-panel')],
  ['modal', modalFill()],
] as const;

describe('battle HUD contrast (WCAG AA)', () => {
  it('keeps every text colour at 4.5:1 on its panel over any arena', () => {
    const texts: [string, Rgb][] = [
      ['ink', hexToken(globals, 'chess-ink')],
      ['muted', hexToken(globals, 'chess-muted')],
      ['gold', hexToken(globals, 'chess-gold')],
      ['jade', hexToken(globals, 'chess-jade')],
      ['demonic', hexToken(css, 'hud-demonic')],
    ];
    for (const [surface, fill] of surfaces) {
      for (const backdrop of [WHITE, BLACK]) {
        const panel = over(fill, backdrop);
        for (const [name, colour] of texts) {
          expect(contrast(colour, panel), `${name} on the ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('keeps a control’s edge at 3:1 against the panel it sits on', () => {
    const edge = rgbaToken('hud-edge');
    const raise = rgbaToken('hud-raise');
    for (const [surface, fill] of surfaces) {
      for (const backdrop of [WHITE, BLACK]) {
        const panel = over(fill, backdrop);
        const line = over(edge, over(raise, panel));
        expect(contrast(line, panel), `edge on the ${surface}`).toBeGreaterThanOrEqual(3);
        // The focus ring (gold) is drawn on the panel too.
        expect(contrast(hexToken(globals, 'chess-gold'), panel)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
