import { describe, expect, it } from 'vitest';
import { CLEAR_SWATCHES } from '../clear-looks';
import { etchColour, mixHex, traceColour } from './decor-colours';

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const linear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luma = (hex: string) => {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('mixHex', () => {
  it('mixes each sRGB channel linearly and rounds', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#ffffff', '#000000', 0.12)).toBe('#e0e0e0');
    expect(mixHex('#102030', '#ffffff', 0)).toBe('#102030');
  });
});

describe('traceColour', () => {
  it('lifts a dark board toward white by 0.22 and darkens a light one by 0.12, for every swatch', () => {
    let dark = 0;
    let light = 0;
    for (const { id, colour } of CLEAR_SWATCHES.board) {
      const expected =
        luma(colour) < 0.5
          ? toHex(channels(colour).map((c) => Math.round(c + (255 - c) * 0.22)))
          : toHex(channels(colour).map((c) => Math.round(c * (1 - 0.12))));
      if (luma(colour) < 0.5) dark++;
      else light++;
      expect(traceColour(colour), id).toBe(expected);
    }
    // Both branches are exercised by the shipped swatches.
    expect(dark).toBeGreaterThan(0);
    expect(light).toBeGreaterThan(0);
  });
});

describe('etchColour', () => {
  it('lifts every shell tint toward white by 0.55', () => {
    for (const { id, tint } of CLEAR_SWATCHES.shell) {
      const expected = toHex(channels(tint).map((c) => Math.round(c + (255 - c) * 0.55)));
      expect(etchColour(tint), id).toBe(expected);
    }
  });
});
