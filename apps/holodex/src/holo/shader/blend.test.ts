import { describe, expect, it } from 'vitest';
import { BLEND_ID, blendGLSL, blendRGB, type BlendMode } from './blend';

const ALL: BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'luminosity',
];

const close = (a: number, b: number) => Math.abs(a - b) < 1e-4;
const rgbClose = (a: readonly number[], b: readonly number[]) => a.every((v, i) => close(v, b[i]));

describe('BLEND_ID', () => {
  it('gives every mode a distinct integer', () => {
    const ids = ALL.map((m) => BLEND_ID[m]);
    expect(ids.every((n) => Number.isInteger(n))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('blendRGB — separable modes against known values', () => {
  it('multiply darkens toward the product', () => {
    expect(
      rgbClose(blendRGB('multiply', [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), [0.25, 0.25, 0.25]),
    ).toBe(true);
    expect(rgbClose(blendRGB('multiply', [1, 1, 1], [0.3, 0.3, 0.3]), [0.3, 0.3, 0.3])).toBe(true);
  });

  it('screen lightens toward the inverse product', () => {
    expect(rgbClose(blendRGB('screen', [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), [0.75, 0.75, 0.75])).toBe(
      true,
    );
    expect(rgbClose(blendRGB('screen', [0, 0, 0], [0.4, 0.4, 0.4]), [0.4, 0.4, 0.4])).toBe(true);
  });

  it('overlay and hard-light are transposes of each other', () => {
    const backdrop = [0.25, 0.6, 0.9] as const;
    const source = [0.7, 0.2, 0.5] as const;
    expect(
      rgbClose(blendRGB('overlay', backdrop, source), blendRGB('hard-light', source, backdrop)),
    ).toBe(true);
  });

  it('darken and lighten pick per channel', () => {
    expect(rgbClose(blendRGB('darken', [0.2, 0.8, 0.5], [0.6, 0.3, 0.5]), [0.2, 0.3, 0.5])).toBe(
      true,
    );
    expect(rgbClose(blendRGB('lighten', [0.2, 0.8, 0.5], [0.6, 0.3, 0.5]), [0.6, 0.8, 0.5])).toBe(
      true,
    );
  });

  it('color-dodge brightens and saturates at white', () => {
    expect(
      rgbClose(blendRGB('color-dodge', [0.25, 0.25, 0.25], [0.5, 0.5, 0.5]), [0.5, 0.5, 0.5]),
    ).toBe(true);
    expect(rgbClose(blendRGB('color-dodge', [0.4, 0.4, 0.4], [1, 1, 1]), [1, 1, 1])).toBe(true);
    expect(rgbClose(blendRGB('color-dodge', [0, 0, 0], [0.7, 0.7, 0.7]), [0, 0, 0])).toBe(true);
  });

  it('difference and exclusion agree at the extremes and differ in the middle', () => {
    expect(rgbClose(blendRGB('difference', [1, 0, 0.5], [0, 1, 0.5]), [1, 1, 0])).toBe(true);
    expect(rgbClose(blendRGB('exclusion', [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), [0.5, 0.5, 0.5])).toBe(
      true,
    );
    expect(rgbClose(blendRGB('difference', [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), [0, 0, 0])).toBe(
      true,
    );
  });

  it('soft-light leaves the backdrop alone at mid-grey source', () => {
    const backdrop = [0.2, 0.55, 0.85] as const;
    expect(rgbClose(blendRGB('soft-light', backdrop, [0.5, 0.5, 0.5]), backdrop)).toBe(true);
  });

  it('normal returns the source', () => {
    expect(rgbClose(blendRGB('normal', [0.1, 0.2, 0.3], [0.7, 0.8, 0.9]), [0.7, 0.8, 0.9])).toBe(
      true,
    );
  });
});

describe('blendRGB — non-separable modes', () => {
  const luma = (c: readonly number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const sat = (c: readonly number[]) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);

  it('luminosity takes the source luma and the backdrop colour', () => {
    const out = blendRGB('luminosity', [0.8, 0.2, 0.2], [0.5, 0.5, 0.5]);
    expect(close(luma(out), 0.5)).toBe(true);
  });

  it('hue takes source hue but keeps backdrop saturation', () => {
    const backdrop = [0.5, 0.45, 0.4] as const;
    const source = [0.9, 0.1, 0.1] as const;
    const out = blendRGB('hue', backdrop, source);
    // Hue keeps the backdrop's saturation (not the source's)
    expect(close(sat(out), sat(backdrop))).toBe(true);
    // Hue also keeps the backdrop's luma
    expect(close(luma(out), luma(backdrop))).toBe(true);
  });

  it('saturation takes source saturation but keeps backdrop hue', () => {
    const backdrop = [0.5, 0.45, 0.4] as const;
    const source = [0.9, 0.1, 0.1] as const;
    const out = blendRGB('saturation', backdrop, source);
    // Saturation keeps the backdrop's luma
    expect(close(luma(out), luma(backdrop))).toBe(true);
    // Saturation takes the source's saturation (much higher than backdrop's, ~0.77 after clipping)
    expect(Math.abs(sat(out) - 0.77) < 0.01).toBe(true);
  });

  it('never produces a channel outside 0..1', () => {
    for (const mode of ALL) {
      for (const [b, s] of [
        [
          [0, 0, 0],
          [1, 1, 1],
        ],
        [
          [1, 1, 1],
          [0, 0, 0],
        ],
        [
          [0.9, 0.1, 0.5],
          [0.2, 0.95, 0.05],
        ],
      ] as const) {
        const out = blendRGB(mode, b, s);
        expect(out.every((v) => v >= -1e-6 && v <= 1 + 1e-6)).toBe(true);
      }
    }
  });
});

describe('blendGLSL', () => {
  it('declares a function for every mode and a dispatcher', () => {
    for (const name of [
      'blendMultiply',
      'blendScreen',
      'blendOverlay',
      'blendDarken',
      'blendLighten',
      'blendColorDodge',
      'blendHardLight',
      'blendSoftLight',
      'blendDifference',
      'blendExclusion',
      'blendHue',
      'blendSaturation',
      'blendLuminosity',
      'blendWith',
    ]) {
      expect(blendGLSL).toContain(name);
    }
  });

  it('dispatches on the same integers the TypeScript side uses', () => {
    for (const mode of ALL) {
      expect(blendGLSL).toContain(`case ${BLEND_ID[mode]}:`);
    }
  });

  it('is balanced source, so a concatenation cannot silently truncate it', () => {
    const opens = (blendGLSL.match(/\{/g) ?? []).length;
    const closes = (blendGLSL.match(/\}/g) ?? []).length;
    expect(opens).toBe(closes);
  });
});
