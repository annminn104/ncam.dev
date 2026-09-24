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
  'plus-lighter',
  'color-burn',
];

const close = (a: number, b: number) => Math.abs(a - b) < 1e-4;
const rgbClose = (a: readonly number[], b: readonly number[]) => a.every((v, i) => close(v, b[i]));

type Triple = readonly [number, number, number];

/**
 * Worked by hand from the W3C formulas, so the TypeScript twin and the GLSL
 * one are each held to the same independent answers rather than to each
 * other. Each row is [backdrop, source, expected].
 */
const HAND_COMPUTED: Record<'plus-lighter' | 'color-burn', Array<[Triple, Triple, Triple]>> = {
  // min(1, b + s)
  'plus-lighter': [
    // 0.2 + 0.3; 0.5 + 0.6 = 1.1, clamped to 1; 0.9 + 0.05
    [
      [0.2, 0.5, 0.9],
      [0.3, 0.6, 0.05],
      [0.5, 1, 0.95],
    ],
    // a black source adds nothing, which is what lets a layer masked to black
    // leave the card beneath it alone
    [
      [0.25, 0.5, 0.75],
      [0, 0, 0],
      [0.25, 0.5, 0.75],
    ],
  ],
  // b == 1 ? 1 : s == 0 ? 0 : 1 - min(1, (1 - b) / s)
  'color-burn': [
    // 1 - 0.2 / 0.5 = 0.6; 1 - 0.8 / 0.5 = -0.6, clamped to 0; 1 - 0.5 / 0.75 = 1/3
    [
      [0.8, 0.2, 0.5],
      [0.5, 0.5, 0.75],
      [0.6, 0, 1 / 3],
    ],
    // a white backdrop stays white even under a black source (b == 1 wins over
    // s == 0); a black source burns anything short of white to black; a white
    // source leaves the backdrop as it was
    [
      [1, 0.6, 0.3],
      [0, 0, 1],
      [1, 0, 0.3],
    ],
    // s == 0 still gives 0 a hair below white, where 1 - (1 - b) / s with the
    // shader's divide-by-zero guard alone would stop at 0.9
    [
      [0.9999999, 0.9999999, 0.9999999],
      [0, 0, 0],
      [0, 0, 0],
    ],
  ],
};

/**
 * Runs the GLSL that `blendWith` dispatches `mode` to, as JavaScript.
 *
 * `blendRGB` clamps every channel on its way out (`perChannel`), so the
 * TypeScript twins pass whether or not their own formulas clamp — and the GLSL
 * has no such net: a plus-lighter that lost its min(), or a color-burn that
 * lost its clamp, leaves the accumulator above 1 or below 0 for the next layer
 * to blend against. Copying the GLSL arithmetic into this file by hand would
 * not catch that; the copy would agree with itself forever. So this translates
 * the shader source itself, following blendWith's own `case` to the function it
 * calls. Both formulas are component-wise, which makes running them one channel
 * at a time on plain numbers exact.
 */
function glslBlend(mode: BlendMode): (b: number, s: number) => number {
  const name = new RegExp(`case ${BLEND_ID[mode]}: return (\\w+)\\(b, s\\);`).exec(blendGLSL)?.[1];
  const body = name
    ? new RegExp(`vec3 ${name}\\(vec3 b, vec3 s\\) \\{([^}]*)\\}`).exec(blendGLSL)?.[1]
    : undefined;
  if (!body) throw new Error(`blendWith no longer dispatches ${mode} to a function read here`);

  const js = body.replace(/\bvec3\(([^()]*)\)/g, '($1)').replace(/\bvec3 (\w+) =/g, 'let $1 =');
  // A translation that left GLSL behind would run something else, so refuse it.
  expect(js).not.toMatch(/\b(?:vec[234]|float|int)\b/);

  const step = (edge: number, x: number) => (x < edge ? 0 : 1);
  const mix = (x: number, y: number, a: number) => x * (1 - a) + y * a;
  const run = new Function('b', 's', 'min', 'max', 'step', 'mix', js) as (
    b: number,
    s: number,
    min: typeof Math.min,
    max: typeof Math.max,
    stepFn: typeof step,
    mixFn: typeof mix,
  ) => number;
  return (b, s) => run(b, s, Math.min, Math.max, step, mix);
}

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

  it('plus-lighter adds the channels and saturates at white', () => {
    for (const [backdrop, source, expected] of HAND_COMPUTED['plus-lighter']) {
      expect(blendRGB('plus-lighter', backdrop, source)).toEqual(
        expected.map((v) => expect.closeTo(v, 4)),
      );
    }
  });

  it('color-burn darkens by the inverse ratio, with W3C’s two special cases', () => {
    for (const [backdrop, source, expected] of HAND_COMPUTED['color-burn']) {
      expect(blendRGB('color-burn', backdrop, source)).toEqual(
        expected.map((v) => expect.closeTo(v, 4)),
      );
    }
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

  for (const mode of ['plus-lighter', 'color-burn'] as const) {
    it(`runs ${mode} to the same hand-computed values, unclamped by any twin`, () => {
      const channel = glslBlend(mode);
      for (const [backdrop, source, expected] of HAND_COMPUTED[mode]) {
        const out = [0, 1, 2].map((i) => channel(backdrop[i], source[i]));
        expect(out).toEqual(expected.map((v) => expect.closeTo(v, 4)));
      }
    });
  }
});
