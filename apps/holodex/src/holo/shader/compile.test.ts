import { describe, expect, it } from 'vitest';
import { BLEND_ID } from './blend';
import { compileEffect, needsRGBA, VERTEX_SHADER } from './compile';
import { baseGLSL } from './base';
import {
  coversPoint,
  cutsFor,
  MAX_CUTS,
  regionFor,
  type CardLayout,
  type CutBox,
  type RegionRect,
} from '../regions';
import type { ClipShape } from '../select';
import {
  BACKGROUND_X,
  BACKGROUND_Y,
  BLACK,
  CENTER,
  MAX_CSS_STOPS,
  WHITE,
  cssStopIndex,
  radial,
  radialT,
  reach,
  stop,
  turn,
  valueAt,
  type CssBox,
} from '../effects/css';
import { EFFECTS } from '../effects';
import { sourcesGLSL } from './sources';
import type { Effect, Element, GradientStop, Layer, PointerDriven } from './types';

const minimal: Effect = {
  id: 'test-minimal',
  shine: [
    {
      layers: [{ source: { kind: 'card' }, blend: 'normal' }],
      mixBlend: 'normal',
    },
  ],
  glare: [],
};

const rich: Effect = {
  id: 'test-rich',
  shine: [
    {
      layers: [
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: -33,
            space: 0.06,
            stops: [
              [0.9, 0.2, 0.2],
              [0.2, 0.4, 0.9],
            ],
          },
          blend: 'luminosity',
          size: [4, 4],
          offset: { x: { base: 0.1, fromLeft: 0.8 }, y: { base: 0, fromTop: 0.5 } },
        },
        { source: { kind: 'glitter', scale: 4 }, blend: 'soft-light' },
      ],
      filter: { brightness: { base: 0.4, fromCenter: 0.4 }, contrast: { base: 2 } },
      mixBlend: 'color-dodge',
      opacity: { base: 0.3, fromCenter: 0.5 },
    },
  ],
  glare: [
    {
      layers: [
        {
          source: {
            kind: 'radial-pointer',
            stops: [
              { at: 0, color: [1, 1, 1] },
              { at: 1, color: [0, 0, 0] },
            ],
          },
          blend: 'normal',
        },
      ],
      mixBlend: 'hard-light',
      opacity: { base: 0.2, fromCenter: 0.8 },
    },
  ],
};

describe('VERTEX_SHADER', () => {
  it('derives vUv from uv and is balanced', () => {
    expect(VERTEX_SHADER).toContain('vUv');
    expect(VERTEX_SHADER).toContain('gl_Position');
    expect((VERTEX_SHADER.match(/\{/g) ?? []).length).toBe(
      (VERTEX_SHADER.match(/\}/g) ?? []).length,
    );
  });

  it('flips uv.y instead of passing three.js uv straight through', () => {
    // three.js's PlaneGeometry puts uv.y = 1 at the top; everything vUv
    // feeds downstream — regions.ts's clip insets, every effect's fromTop
    // offset, the CSS-derived gradients — is authored y-down. A silent
    // revert to `vUv = uv;` would invert the foil vertically across all 22
    // effects with a fully green suite, since ShaderMaterial is inert until
    // a GPU links it. This is the one place under `node` that can catch it.
    expect(VERTEX_SHADER).not.toContain('vUv = uv;');
    expect(VERTEX_SHADER).toMatch(/vUv\s*=\s*vec2\(\s*uv\.x\s*,\s*1\.0\s*-\s*uv\.y\s*\)/);
  });
});

describe('compileEffect', () => {
  it('produces a complete, balanced fragment shader', () => {
    const src = compileEffect(minimal);
    expect(src).toContain('void main()');
    expect(src).toContain('precision');
    expect((src.match(/\{/g) ?? []).length).toBe((src.match(/\}/g) ?? []).length);
    expect((src.match(/\(/g) ?? []).length).toBe((src.match(/\)/g) ?? []).length);
  });

  it('includes the blend and source libraries exactly once', () => {
    const src = compileEffect(minimal);
    expect(src.split('vec3 blendWith(').length - 1).toBe(1);
    expect(src.split('vec3 uvTransform(').length - 1).toBe(0); // uvTransform returns vec2
    expect(src.split('vec2 uvTransform(').length - 1).toBe(1);
  });

  it('is deterministic — the same effect compiles to the same source', () => {
    expect(compileEffect(rich)).toBe(compileEffect(rich));
  });

  it('emits no #version directive — three.js prepends its own', () => {
    // three.js builds '#version ' + glslVersion in WebGLProgram when the
    // material sets glslVersion, and GLSL3 === '300 es'. A second directive
    // here is a GLSL compile error that only shows on a real GPU, so this
    // assertion is the only thing standing between us and a black card.
    expect(compileEffect(rich)).not.toContain('#version');
    expect(compileEffect(minimal)).not.toContain('#version');
  });

  it('declares its own fragment output, which GLSL3 does not provide', () => {
    // For GLSL3 three.js deliberately omits its pc_fragColor shim, so the
    // shader must declare `out vec4 fragColor` itself — baseGLSL does.
    expect(compileEffect(minimal)).toContain('out vec4 fragColor');
    expect(compileEffect(minimal)).toContain('fragColor =');
  });

  it('names the effect in a comment so a shader log can be traced back', () => {
    expect(compileEffect(rich)).toContain('test-rich');
  });

  it('inlines gradient stops as literals rather than uniforms', () => {
    const src = compileEffect(rich);
    expect(src).toContain('0.9');
    expect(src).toContain('vec3(0.900000, 0.200000, 0.200000)');
    expect(src).not.toContain('uniform vec3 uStops');
  });

  it('pads a gradient with 2 stops to exactly MAX_STOPS (8) elements', () => {
    // vec3[MAX_STOPS](...) is a GLSL ES 3.0 array constructor: every src*
    // sampler declares its stops parameter as vec3 stops[MAX_STOPS], and an
    // argument whose element count does not match exactly fails to compile
    // — on a GPU only, invisible to every other assertion in this file.
    // `rich`'s repeating-linear source has exactly 2 real stops.
    const src = compileEffect(rich);
    const match = src.match(/vec3\[MAX_STOPS\]\(([^;]*)\);/);
    expect(match).not.toBeNull();
    const entryCount = (match?.[1].match(/vec3\(/g) ?? []).length;
    expect(entryCount).toBe(8);
  });

  it('emits the blend id for every layer and element blend', () => {
    const src = compileEffect(rich);
    // soft-light for the stack's second layer (the base layer at index 0 has
    // nothing beneath it to blend against, so its own blend mode is
    // structurally inapplicable and never emitted — matching CSS
    // background-blend-mode, where the bottom layer blends against nothing),
    // color-dodge for the element, hard-light for glare
    expect(src).toContain('blendWith(8');
    expect(src).toContain('blendWith(6');
    expect(src).toContain('blendWith(7');
  });

  // `uPointerFromCenter` and `uPointerUV` are declared unconditionally in
  // sourcesGLSL, which is spliced into every compiled effect regardless of
  // whether any PointerDriven value in this particular effect uses them. So
  // merely grepping for the identifier passes even if `driven()` ignored
  // every coefficient and emitted only the base — these three tests instead
  // compile two effects that differ in exactly one PointerDriven coefficient
  // and check both that the sources diverge and that the emitted expression
  // is the actual multiplication `driven()` produces.
  it('emits a multiplication by uPointerFromCenter only when fromCenter is set', () => {
    const withCenter: Effect = {
      id: 'pd-center',
      shine: [
        {
          layers: [{ source: { kind: 'card' }, blend: 'normal' }],
          mixBlend: 'normal',
          opacity: { base: 0.3, fromCenter: 0.5 },
        },
      ],
      glare: [],
    };
    const withoutCenter: Effect = {
      ...withCenter,
      shine: [{ ...withCenter.shine[0], opacity: { base: 0.3 } }],
    };
    const a = compileEffect(withCenter);
    const b = compileEffect(withoutCenter);
    expect(a).not.toBe(b);
    expect(a).toContain('0.500000 * uPointerFromCenter');
    expect(b).not.toContain('0.500000 * uPointerFromCenter');
  });

  it('emits a multiplication by uPointerUV.x only when fromLeft is set', () => {
    const withLeft: Effect = {
      id: 'pd-left',
      shine: [
        {
          layers: [
            {
              source: { kind: 'card' },
              blend: 'normal',
              offset: { x: { base: 0.1, fromLeft: 0.8 }, y: { base: 0 } },
            },
          ],
          mixBlend: 'normal',
        },
      ],
      glare: [],
    };
    const withoutLeft: Effect = {
      ...withLeft,
      shine: [
        {
          ...withLeft.shine[0],
          layers: [
            { ...withLeft.shine[0].layers[0], offset: { x: { base: 0.1 }, y: { base: 0 } } },
          ],
        },
      ],
    };
    const a = compileEffect(withLeft);
    const b = compileEffect(withoutLeft);
    expect(a).not.toBe(b);
    expect(a).toContain('0.800000 * (uPointerUV.x)');
    expect(b).not.toContain('0.800000 * (uPointerUV.x)');
  });

  it('emits a multiplication by uPointerUV.y only when fromTop is set', () => {
    const withTop: Effect = {
      id: 'pd-top',
      shine: [
        {
          layers: [
            {
              source: { kind: 'card' },
              blend: 'normal',
              offset: { x: { base: 0 }, y: { base: 0.2, fromTop: 0.6 } },
            },
          ],
          mixBlend: 'normal',
        },
      ],
      glare: [],
    };
    const withoutTop: Effect = {
      ...withTop,
      shine: [
        {
          ...withTop.shine[0],
          layers: [{ ...withTop.shine[0].layers[0], offset: { x: { base: 0 }, y: { base: 0.2 } } }],
        },
      ],
    };
    const a = compileEffect(withTop);
    const b = compileEffect(withoutTop);
    expect(a).not.toBe(b);
    expect(a).toContain('0.600000 * (uPointerUV.y)');
    expect(b).not.toContain('0.600000 * (uPointerUV.y)');
  });

  it('emits no glare block when an effect has none', () => {
    const src = compileEffect(minimal);
    // sourcesGLSL is spliced in whole for every effect (the library-inclusion
    // test above pins that), so a bare function name like srcRadialPointer is
    // always present in its definition regardless of usage. The thing that
    // actually varies with effect.glare is the per-element codegen block,
    // marked by this comment.
    expect(src).not.toContain('// --- glare');
  });

  // Region clipping is the spec's headline feature, and it used to be pinned
  // by `toContain('coverage')` / `toContain('uInvert')` — two strings baseGLSL
  // emits unconditionally, spliced into every effect whether or not
  // compileEffect ever applies the clip. Deleting both generated lines left
  // the whole suite green. These assert on the generated statements instead,
  // which exist only because compileEffect writes them.
  it('applies the clip coverage exactly once', () => {
    const src = compileEffect(rich);
    expect(src.split('float cov = coverage(vUv);').length - 1).toBe(1);
    expect(src.split('acc = mix(art, acc, cov);').length - 1).toBe(1);
  });

  it('clips the shine but leaves the glare covering the whole card', () => {
    // Ordering is the behaviour: shine accumulates into `acc`, the clip mix
    // confines it to the region, and only then does glare go on top. That
    // matches the reference, where .card__shine carries the clip-path and
    // .card__glare does not. Moving the mix below the glare block would clip
    // the glare too — a change no string-presence assertion can see.
    const src = compileEffect(rich);
    const clip = src.indexOf('acc = mix(art, acc, cov);');
    const glareBlock = src.indexOf('// --- glare0');
    expect(clip).toBeGreaterThan(-1);
    expect(glareBlock).toBeGreaterThan(-1);
    const firstGlareMix = src.indexOf('acc = mix(acc, blendWith(', glareBlock);
    expect(firstGlareMix).toBeGreaterThan(-1);
    expect(clip).toBeLessThan(firstGlareMix);
  });

  it('takes its cut-out boxes from uniforms, one for each box regions.ts may cut', () => {
    // base.ts used to hardcode the stage step while regions.ts owned the same
    // pair for coversPoint, and editing either alone left the suite green with
    // the CPU and GPU clips disagreeing. Now every number comes from
    // regions.ts through the scene (cutsFor, cutUniform), and the shader
    // holds none: only as many box uniforms as a region may cut.
    const src = compileEffect(minimal);
    expect(src.match(/uniform vec4 uCut[A-Z];/g)).toHaveLength(MAX_CUTS);
    expect(src).not.toContain('STAGE_STEP');
  });

  it('emits the element filter rather than dropping it on the floor', () => {
    // `rich`'s shine element sets brightness (pointer-driven) and contrast but
    // not saturate, so the third argument falls back to the 1.0 default.
    const src = compileEffect(rich);
    expect(src).toContain(
      'stack_shine0 = applyFilter(stack_shine0, (0.400000 + 0.400000 * uPointerFromCenter), (2.000000), 1.000000);',
    );
    const unfiltered: Effect = { ...rich, shine: [{ ...rich.shine[0], filter: undefined }] };
    const bare = compileEffect(unfiltered);
    expect(bare).not.toBe(src);
    expect(bare).toContain(
      'stack_shine0 = applyFilter(stack_shine0, 1.000000, 1.000000, 1.000000);',
    );
  });

  it("emits a layer's size into its uvTransform rather than ignoring it", () => {
    const sized: Effect = {
      ...minimal,
      shine: [{ ...minimal.shine[0], layers: [{ ...minimal.shine[0].layers[0], size: [6, 6] }] }],
    };
    const a = compileEffect(sized);
    const b = compileEffect(minimal);
    expect(a).not.toBe(b);
    expect(a).toContain('uvTransform(vUv, vec2(6.000000, 6.000000)');
    expect(b).toContain('uvTransform(vUv, vec2(1.000000, 1.000000)');
  });

  it('scales every element mix by uCardOpacity', () => {
    const src = compileEffect(rich);
    const mixes = src.match(/acc = mix\(acc, blendWith\([^;]*\);/g) ?? [];
    // one shine element, one glare element
    expect(mixes).toHaveLength(2);
    for (const line of mixes) expect(line).toContain('uCardOpacity');
  });

  it('compiles each generated-texture layer to a call on its own sampler', () => {
    // Every sampler's definition is spliced into every shader, so finding its
    // name in the source proves nothing. The statement below exists only
    // because this layer asked for it: the right sampler, the layer's own uv,
    // the layer's own scale. A case copied from its neighbour and left calling
    // srcGlitter compiles, links and renders glitter where iri belongs.
    const samplers = {
      iri: 'srcIri',
      birthday: 'srcBirthday',
      pokeball: 'srcPokeball',
      'pokeball-inner': 'srcPokeballInner',
      masterball: 'srcMasterball',
      'masterball-inner': 'srcMasterballInner',
    } as const;
    for (const [kind, sampler] of Object.entries(samplers) as Array<
      [keyof typeof samplers, string]
    >) {
      const src = compileEffect({
        id: `texture-${kind}`,
        shine: [
          { layers: [{ source: { kind, scale: 2.5 }, blend: 'normal' }], mixBlend: 'normal' },
        ],
        glare: [],
      });
      expect(src, kind).toContain(`vec3 src_shine0_0 = ${sampler}(uv_shine0_0, 2.500000);`);
    }
  });

  it('handles every source kind without throwing', () => {
    // All 15 Source['kind'] variants (SOURCE_ID order) — repeating-linear,
    // radial-pointer and glitter were previously only exercised incidentally
    // by the `rich` fixture, not by this test's own layer list.
    const kinds: Effect['shine'][number]['layers'] = [
      { source: { kind: 'solid', color: [1, 0, 0] }, blend: 'normal' },
      {
        source: {
          kind: 'repeating-linear',
          angleDeg: -33,
          space: 0.06,
          stops: [
            [0.9, 0.2, 0.2],
            [0.2, 0.4, 0.9],
          ],
        },
        blend: 'normal',
      },
      {
        source: {
          kind: 'linear',
          angleDeg: 45,
          stops: [
            [1, 1, 1],
            [0, 0, 0],
          ],
        },
        blend: 'normal',
      },
      {
        source: {
          kind: 'radial-pointer',
          stops: [
            { at: 0, color: [1, 1, 1] },
            { at: 1, color: [0, 0, 0] },
          ],
        },
        blend: 'normal',
      },
      {
        source: {
          kind: 'conic',
          stops: [
            [1, 0, 0],
            [0, 1, 0],
          ],
        },
        blend: 'normal',
      },
      { source: { kind: 'glitter', scale: 4 }, blend: 'normal' },
      { source: { kind: 'grain', scale: 2 }, blend: 'normal' },
      { source: { kind: 'scanlines', spacing: 0.01, light: 0.4, dark: 0 }, blend: 'normal' },
      { source: { kind: 'card' }, blend: 'normal' },
      { source: { kind: 'iri', scale: 3 }, blend: 'plus-lighter' },
      { source: { kind: 'birthday', scale: 0.7 }, blend: 'color-burn' },
      { source: { kind: 'pokeball', scale: 2.5 }, blend: 'multiply' },
      { source: { kind: 'pokeball-inner', scale: 2.5 }, blend: 'multiply' },
      { source: { kind: 'masterball', scale: 2.5 }, blend: 'multiply' },
      { source: { kind: 'masterball-inner', scale: 2.5 }, blend: 'multiply' },
    ];
    const all: Effect = {
      id: 'all-kinds',
      shine: [{ layers: kinds, mixBlend: 'normal' }],
      glare: [],
    };
    expect(() => compileEffect(all)).not.toThrow();
    const src = compileEffect(all);
    expect((src.match(/\{/g) ?? []).length).toBe((src.match(/\}/g) ?? []).length);
  });
});

/**
 * `coverage()` is GLSL, so nothing under `node` can call it, and base.ts calls
 * `coversPoint` its "tested twin" without anything checking the claim —
 * swapping uClipRect's top/bottom components, or dropping the uInvert term
 * that reverse holo depends on entirely, both left the suite green.
 *
 * Hand-copying the arithmetic into JS would not fix that: the copy would agree
 * with `coversPoint` forever regardless of what base.ts said. So this
 * translates the *emitted GLSL itself* into JS and executes that. Mutating the
 * shader mutates what runs here.
 */
function transpileCoverage(glsl: string) {
  const inBox = /float inBox\(vec2 uv, vec4 box\) \{\n([\s\S]*?)\n\}/.exec(glsl)?.[1];
  const body = /float coverage\(vec2 uv\) \{\n([\s\S]*?)\n\}/.exec(glsl)?.[1];
  if (!inBox || !body) {
    throw new Error('coverage() no longer has the shape this translation assumes');
  }

  const toJS = (src: string) =>
    src
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\bfloat /g, 'let ')
      .replace(/uClipRect\.x/g, 'rect.top')
      .replace(/uClipRect\.y/g, 'rect.right')
      .replace(/uClipRect\.z/g, 'rect.bottom')
      .replace(/uClipRect\.w/g, 'rect.left')
      .replace(/\bbox\.x\b/g, 'box.x0')
      .replace(/\bbox\.y\b/g, 'box.y0')
      .replace(/\bbox\.z\b/g, 'box.x1')
      .replace(/\bbox\.w\b/g, 'box.y1')
      .replace(/\buCutA\b/g, 'cutA')
      .replace(/\buCutB\b/g, 'cutB')
      .replace(/\buCutC\b/g, 'cutC')
      .replace(/uBorder\.x/g, 'ring.top')
      .replace(/uBorder\.y/g, 'ring.right')
      .replace(/uBorder\.z/g, 'ring.bottom')
      .replace(/uBorder\.w/g, 'ring.left')
      .replace(/uInvert/g, 'invert');
  const js = `const inBox = (uv, box) => {\n${toJS(inBox)}\n};\n${toJS(body)}`;

  // A translation that quietly left GLSL behind would be a twin all over
  // again, so fail loudly rather than evaluate something half-converted.
  expect(js).not.toMatch(/\bu[A-Z]\w*/);
  expect(js).not.toMatch(/\b(?:float|vec[234]|uniform)\b/);

  const step = (edge: number, v: number) => (v >= edge ? 1 : 0);
  const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  const compiled = new Function(
    'uv',
    'rect',
    'cutA',
    'cutB',
    'cutC',
    'ring',
    'invert',
    'step',
    'mix',
    'max',
    js,
  ) as (
    uv: { x: number; y: number },
    rect: RegionRect,
    cutA: CutBox,
    cutB: CutBox,
    cutC: CutBox,
    ring: RegionRect,
    invert: number,
    step: (edge: number, v: number) => number,
    mix: (a: number, b: number, t: number) => number,
    max: (a: number, b: number) => number,
  ) => number;

  // A box the region lacks reaches the shader as all zeros (scene.ts's
  // cutUniform), and so does the border it does not foil (borderUniform).
  const none: CutBox = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const noBorder: RegionRect = { top: 0, right: 0, bottom: 0, left: 0 };
  return (
    shape: ClipShape,
    x: number,
    y: number,
    invert: boolean,
    layout?: CardLayout,
    border = false,
  ) => {
    const [cutA = none, cutB = none, cutC = none] = cutsFor(shape, layout);
    const ring = border ? regionFor('borders') : noBorder;
    return compiled(
      { x, y },
      regionFor(shape, layout),
      cutA,
      cutB,
      cutC,
      ring,
      invert ? 1 : 0,
      step,
      mix,
      Math.max,
    );
  };
}

describe('coverage() in GLSL agrees with coversPoint() in JS', () => {
  const coverage = transpileCoverage(baseGLSL);
  const shapes: ClipShape[] = ['full', 'regular', 'stage', 'trainer', 'borders'];
  const layouts: CardLayout[] = [
    'wotc',
    'e-card',
    'ex',
    'dp',
    'dp-sp',
    'lv-x',
    'hgss',
    'prime',
    'legend',
    'bw-xy',
    'sm',
    'swsh',
    'sv',
    'pocket',
    'modern-ex',
    'sv-illustration',
    'pocket-illustration',
    'sv-special-illustration',
    'sv-hyper',
    'sv-hyper-ex',
    'sv-ultra',
    'sv-ultra-ex',
    'swsh-ultra',
    'swsh-ultra-v',
    'swsh-gallery-v',
    'swsh-gallery-vmax',
    'full-card',
    'other',
  ];
  // Deliberately offset off the round numbers so no sample lands exactly on an
  // inset edge, and fine enough that each of the thin banners holds a row.
  const axis = Array.from({ length: 81 }, (_, i) => (i / 80) * 0.98 + 0.0107);

  for (const layout of layouts) {
    it(`agrees across the card for every shape on ${layout}, inverted or not, border or not`, () => {
      const disagreements: string[] = [];
      for (const shape of shapes) {
        for (const invert of [false, true]) {
          for (const border of [false, true]) {
            for (const x of axis) {
              for (const y of axis) {
                const gpu = coverage(shape, x, y, invert, layout, border) > 0.5;
                const cpu = coversPoint(shape, x, y, invert, layout, border);
                if (gpu !== cpu) {
                  disagreements.push(
                    `${shape}${invert ? '/inv' : ''}${border ? '/border' : ''} (${x.toFixed(3)}, ${y.toFixed(3)}) gpu=${gpu} cpu=${cpu}`,
                  );
                }
              }
            }
          }
        }
      }
      expect(disagreements).toEqual([]);
    });
  }

  it('adds the border to the region only when asked, and all of it', () => {
    // The corner and the bottom edge: outside the `borders` rect.
    for (const [x, y] of [
      [0.02, 0.02],
      [0.5, 0.985],
      [0.98, 0.5],
    ]) {
      expect(coverage('regular', x, y, false, 'sv', true)).toBe(1);
      expect(coverage('regular', x, y, false, 'sv', false)).toBe(0);
    }
    // The frame between the border and the art stays bare.
    expect(coverage('regular', 0.06, 0.3, false, 'sv', true)).toBe(0);
    expect(coverage('regular', 0.5, 0.7, false, 'sv', true)).toBe(0);
  });

  it('actually exercises both verdicts, so agreement is not vacuous', () => {
    // A coverage() stuck at a constant would "agree" with nothing to compare.
    expect(coverage('regular', 0.5, 0.3, false)).toBe(1);
    expect(coverage('regular', 0.5, 0.8, false)).toBe(0);
    expect(coverage('regular', 0.5, 0.8, true)).toBe(1);
  });

  it('cuts out every box of every layout, where the art would take the foil', () => {
    // The middle of each box's overlap with the art window: inside the rect,
    // so only the box can keep the foil off it.
    for (const layout of layouts) {
      for (const shape of ['regular', 'stage'] as const) {
        const r = regionFor(shape, layout);
        for (const c of cutsFor(shape, layout)) {
          const x = (Math.max(c.x0, r.left) + Math.min(c.x1, 1 - r.right)) / 2;
          const y = (Math.max(c.y0, r.top) + Math.min(c.y1, 1 - r.bottom)) / 2;
          const where = `${layout} ${shape} (${x.toFixed(3)}, ${y.toFixed(3)})`;
          expect(x >= r.left && x <= 1 - r.right && y >= r.top && y <= 1 - r.bottom, where).toBe(
            true,
          );
          expect(coverage(shape, x, y, false, layout), where).toBe(0);
        }
      }
    }
  });
});

type V = { x: number; y: number };
const V = (x: number, y: number): V => ({ x, y });

/** Every GLSL built-in a translated function could reach for, so a mutant fails on its values. */
const BUILTINS = {
  min: Math.min,
  max: Math.max,
  sqrt: Math.sqrt,
  clamp: (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)),
  mix: (a: number, b: number, t: number) => a * (1 - t) + b * t,
  fract: (v: number) => v - Math.floor(v),
  atan: (y: number, x: number) => Math.atan2(y, x),
};

/**
 * A scalar function of sourcesGLSL translated into JS, so what runs here is
 * the shader's own arithmetic, not a copy of it: mutate the GLSL and this
 * mutates too.
 */
function transpileSource(signature: RegExp, params: string[]) {
  const body = signature.exec(sourcesGLSL)?.[1];
  const aspect = /const float CARD_HEIGHT_OVER_WIDTH = ([^;]+);/.exec(sourcesGLSL)?.[1];
  if (!body || !aspect)
    throw new Error(`${signature} no longer has the shape this translation assumes`);
  const js = body
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\bfloat\(/g, '(')
    .replace(/\b(?:float|int) /g, 'let ')
    .replace(/MAX_CSS_STOPS/g, String(MAX_CSS_STOPS))
    .replace(/CARD_HEIGHT_OVER_WIDTH/g, String(Number(aspect)));
  // A translation that quietly left GLSL behind would be a twin all over again.
  expect(js).not.toMatch(/\bu[A-Z]\w*/);
  expect(js).not.toMatch(/\b(?:float|int|vec[234]|uniform)\b/);
  const run = new Function(...params, ...Object.keys(BUILTINS), js) as (
    ...args: unknown[]
  ) => number;
  return (...args: unknown[]) => run(...args, ...Object.values(BUILTINS));
}

const radialReachGLSL = transpileSource(
  /float radialReach\(vec2 uv, vec2 centre, vec2 size, vec2 at, float ellipse\) \{\n([\s\S]*?)\n\}/,
  ['uv', 'centre', 'size', 'at', 'ellipse'],
);

/**
 * A css.ts radial's distance as the shader works it out: sources.ts's
 * radialCssDistance, which is radialReach at the pointer, as a circle,
 * clamped. Held to css.ts's radialT, the twin css.test.ts holds to CSS's own
 * farthest-corner geometry.
 */
function radialCssDistanceGLSL(uv: V, centre: V, size: V, pointer: V): number {
  expect(sourcesGLSL).toMatch(
    /float radialCssDistance\(vec2 uv, vec2 centre, vec2 size\) \{\n\s+return clamp\(radialReach\(uv, centre, size, uPointerUV, 0\.0\), 0\.0, 1\.0\);\n\}/,
  );
  return BUILTINS.clamp(radialReachGLSL(uv, centre, size, pointer, 0), 0, 1);
}

describe('a converted radial’s reach in GLSL agrees with radialT() in JS', () => {
  const distance = radialCssDistanceGLSL;
  const boxes: CssBox[] = [
    { size: [1, 1], position: [CENTER, CENTER] },
    { size: [2, 1], position: [BACKGROUND_X, BACKGROUND_Y] },
    { size: [1.2, 1.5], position: [CENTER, CENTER] },
  ];
  const pointers = [
    { fromLeft: 0, fromTop: 0 },
    { fromLeft: 0.5, fromTop: 0.5 },
    { fromLeft: 0.9, fromTop: 0.2 },
  ];
  const points: Array<[number, number]> = [
    [0, 0],
    [0.5, 0.5],
    [0.3, 0.8],
    [1, 1],
  ];

  it('works out the same distance at every point, pointer and image', () => {
    for (const box of boxes) {
      const layer = radial([stop(WHITE, 0), stop(BLACK, 100)], box);
      if (layer.source.kind !== 'radial-pointer' || !layer.source.cssBox) {
        throw new Error('radial() no longer draws with the CSS geometry');
      }
      const { centre, size } = layer.source.cssBox;
      for (const at of pointers) {
        const c = { x: valueAt(centre[0], at, 0), y: valueAt(centre[1], at, 0) };
        const pointer = { x: at.fromLeft, y: at.fromTop };
        for (const [u, v] of points) {
          // to 6 places: the GLSL's CARD_HEIGHT_OVER_WIDTH is written to 6 decimals
          expect(distance({ x: u, y: v }, c, { x: size[0], y: size[1] }, pointer)).toBeCloseTo(
            radialT(layer, [u, v], at),
            6,
          );
        }
      }
    }
  });

  it('draws a converted radial with that geometry and leaves a hand-drawn one on its own', () => {
    const converted = radial([stop(WHITE, 0), stop(BLACK, 100)], {
      size: [1.2, 1.5],
      position: [CENTER, CENTER],
    });
    const handDrawn = {
      source: {
        kind: 'radial-pointer' as const,
        stops: [
          { at: 0, color: WHITE },
          { at: 1, color: BLACK },
        ],
      },
    };
    const src = compileEffect({
      id: 'test-radials',
      shine: [
        { layers: [{ ...converted, blend: 'normal' }], mixBlend: 'normal' },
        { layers: [{ ...handDrawn, blend: 'normal' }], mixBlend: 'normal' },
      ],
      glare: [],
    });
    expect(src).toMatch(
      /src_shine0_0 = srcRadialCss\(uv_shine0_0, vec2\(.*uPointerUV\.x.*\), vec2\(1\.200000, 1\.500000\), /,
    );
    expect(src).toMatch(/src_shine1_0 = srcRadialPointer\(uv_shine1_0, /);
  });
});

describe('the exact gradients’ geometry in GLSL agrees with css.ts', () => {
  const conicTurnGLSL = transpileSource(
    /float conicTurn\(vec2 uv, vec2 centre, float from\) \{\n([\s\S]*?)\n\}/,
    ['uv', 'centre', 'from'],
  );
  const cssStopIndexGLSL = transpileSource(
    /float cssStopIndex\(float pos\[MAX_CSS_STOPS\], int count, float t\) \{\n([\s\S]*?)\n\}/,
    ['pos', 'count', 't'],
  );

  it('radialReach: circles and ellipses, wherever their centre sits', () => {
    for (const ellipse of [false, true]) {
      for (const at of [
        [0.5, 0.5],
        [0.2, 0.7],
        [0.9, 0.1],
      ] as Array<[number, number]>) {
        for (const uv of [
          [0, 0],
          [0.3, 0.8],
          [1, 0.4],
        ] as Array<[number, number]>) {
          const want = reach([0.4, 0.6], [1.5, 2], at, ellipse, uv);
          const got = radialReachGLSL(V(...uv), V(0.4, 0.6), V(1.5, 2), V(...at), ellipse ? 1 : 0);
          expect(got).toBeCloseTo(want, 6);
        }
      }
    }
  });

  it('conicTurn: all the way round, from wherever it starts', () => {
    for (let k = 0; k < 16; k += 1) {
      const a = (k / 16) * 2 * Math.PI;
      const uv: [number, number] = [0.5 + 0.3 * Math.sin(a), 0.5 - 0.3 * Math.cos(a)];
      expect(conicTurnGLSL(V(...uv), V(0.5, 0.5), 0.1)).toBeCloseTo(turn([0.5, 0.5], 0.1, uv), 6);
    }
  });

  it('cssStopIndex: before, between, past hard edges, after', () => {
    const pos = [0, 0.012, 0.0121, 0.024, 0.024, 0.5, 1];
    const padded = [...pos, ...Array<number>(MAX_CSS_STOPS - pos.length).fill(1)];
    for (const t of [-1, 0, 0.006, 0.012, 0.01205, 0.02, 0.024, 0.3, 0.99, 1, 2]) {
      expect(cssStopIndexGLSL(padded, pos.length, t)).toBeCloseTo(cssStopIndex(pos, t), 6);
    }
  });
});

describe('glare painted beneath the shine', () => {
  const plain = {
    layers: [{ source: { kind: 'card' as const }, blend: 'normal' as const }],
    mixBlend: 'normal' as const,
  };
  const src = compileEffect({
    id: 'test-beneath',
    beneath: [{ ...plain, mixBlend: 'multiply' }],
    shine: [{ ...plain, mixBlend: 'color-dodge' }],
    glare: [{ ...plain, mixBlend: 'overlay' }],
  });
  const at = (needle: string) => {
    const i = src.indexOf(needle);
    if (i < 0) throw new Error(`missing: ${needle}`);
    return i;
  };

  it('paints it onto the card first, then the shine over it, then the glare above', () => {
    expect(at('// --- beneath0')).toBeLessThan(at('// --- shine0'));
    expect(at('// --- shine0')).toBeLessThan(at('// --- glare0'));
  });

  it('clips the shine against what lies beneath it, so the clip keeps the glare', () => {
    // the backdrop is taken after the beneath elements and before the shine
    expect(at('vec3 base = acc;')).toBeGreaterThan(at('// --- beneath0'));
    expect(at('vec3 base = acc;')).toBeLessThan(at('// --- shine0'));
    expect(src).toContain('acc = mix(base, acc, cov);');
    expect(src).not.toContain('acc = mix(art, acc, cov);');
  });

  it('leaves an effect with nothing beneath exactly as it compiled before', () => {
    const without = compileEffect({ id: 'test-no-beneath', shine: [plain], glare: [plain] });
    expect(without).toContain('acc = mix(art, acc, cov);');
    expect(without).not.toMatch(/\/\/ --- beneath|vec3 base = acc/);
  });
});

type ElementClip = Exclude<ClipShape, 'stage'>;

const clippedEffect = (clip: ElementClip): Effect => ({
  id: 'test-element-clip',
  shine: [{ layers: [{ source: { kind: 'card' }, blend: 'normal' }], mixBlend: 'normal', clip }],
  glare: [],
});

/**
 * An element's own `clip` (types.ts), as the compiler emits it: the region's
 * insets written into a `clip_<prefix>` factor through base.ts's insideRect().
 * Translated and run the way coverage() is above, from the emitted GLSL
 * itself, so a swapped inset or a misread vec4 component cannot hide behind a
 * copy of the arithmetic.
 */
function transpileElementClip(clip: ElementClip) {
  const glsl = compileEffect(clippedEffect(clip));
  const insets = /float clip_shine0 = insideRect\(vUv, vec4\(([^)]*)\)\);/.exec(glsl)?.[1];
  const body = /float insideRect\(vec2 uv, vec4 inset\) \{\n([\s\S]*?)\n\}/.exec(glsl)?.[1];
  if (!insets || !body) {
    throw new Error('the element clip no longer has the shape this translation assumes');
  }
  const js = body
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/inset\.x/g, 'inset[0]')
    .replace(/inset\.y/g, 'inset[1]')
    .replace(/inset\.z/g, 'inset[2]')
    .replace(/inset\.w/g, 'inset[3]');
  expect(js).not.toMatch(/\b(?:float|vec[234]|uniform)\b/);

  const values = insets.split(',').map(Number);
  const step = (edge: number, v: number) => (v >= edge ? 1 : 0);
  const run = new Function('uv', 'inset', 'step', js) as (
    uv: { x: number; y: number },
    inset: number[],
    step: (edge: number, v: number) => number,
  ) => number;
  return (x: number, y: number) => run({ x, y }, values, step);
}

describe('an element’s own clip in GLSL agrees with coversPoint() in JS', () => {
  const clips: ElementClip[] = ['full', 'regular', 'trainer', 'borders'];
  const axis = Array.from({ length: 21 }, (_, i) => (i / 20) * 0.98 + 0.011);

  for (const clip of clips) {
    it(`agrees across the card for ${clip}`, () => {
      const inside = transpileElementClip(clip);
      const disagreements: string[] = [];
      for (const x of axis) {
        for (const y of axis) {
          const gpu = inside(x, y) > 0.5;
          const cpu = coversPoint(clip, x, y, false);
          if (gpu !== cpu)
            disagreements.push(`(${x.toFixed(3)}, ${y.toFixed(3)}) gpu=${gpu} cpu=${cpu}`);
        }
      }
      expect(disagreements).toEqual([]);
    });
  }

  it('actually exercises both verdicts, so agreement is not vacuous', () => {
    const inside = transpileElementClip('borders');
    expect(inside(0.5, 0.5)).toBe(1);
    expect(inside(0.02, 0.5)).toBe(0);
    expect(inside(0.5, 0.99)).toBe(0);
  });

  it('gates only the clipped element’s own mix, and leaves the others alone', () => {
    const plain = {
      layers: [{ source: { kind: 'card' as const }, blend: 'normal' as const }],
      mixBlend: 'normal' as const,
    };
    const src = compileEffect({
      id: 'test-element-clip-scope',
      shine: [{ ...plain, clip: 'borders' }, plain],
      glare: [plain],
    });
    const mixOf = (prefix: string) =>
      src
        .split('\n')
        .find(
          (line) => line.includes(`acc = mix(acc, blendWith(`) && line.includes(`stack_${prefix})`),
        );
    expect(mixOf('shine0')).toMatch(/\* clip_shine0\);$/);
    expect(mixOf('shine1')).not.toMatch(/clip_/);
    expect(mixOf('glare0')).not.toMatch(/clip_/);
    expect(src.match(/float clip_/g)).toHaveLength(1);
  });

  it('confines a glare that asks to the effect’s own region, on either path, and no other', () => {
    const plain = {
      layers: [{ source: { kind: 'card' as const }, blend: 'normal' as const }],
      mixBlend: 'normal' as const,
    };
    const rgba = {
      layers: [{ source: { kind: 'illusion-mask' as const, scale: 1 }, blend: 'normal' as const }],
      mixBlend: 'normal' as const,
    };
    const src = compileEffect({
      id: 'test-within-region',
      shine: [plain],
      glare: [
        { ...plain, clip: 'borders', withinRegion: true },
        { ...rgba, withinRegion: true },
        plain,
      ],
    });
    const mixOf = (prefix: string) =>
      src
        .split('\n')
        .find(
          (line) =>
            line.startsWith('  acc = mix(acc, blendWith(') && line.includes(`stack_${prefix}`),
        );
    expect(mixOf('glare0')).toMatch(/\* clip_glare0 \* cov\);$/);
    expect(mixOf('glare1')).toMatch(/\* cov\);$/);
    expect(mixOf('glare2')).not.toMatch(/cov/);
    // cov is main()'s coverage(vUv), computed before any element reads it.
    expect(src.indexOf('float cov = coverage(vUv);')).toBeLessThan(src.indexOf('// --- glare0'));
  });

  it('keeps the ball holos’ glare inside the border and off the art, as --viewport-edge-clip', () => {
    for (const id of ['poke-ball-holo', 'masterball-holo'] as const) {
      const glare = EFFECTS[id].glare;
      expect(glare.map((e) => [e.clip, e.withinRegion])).toEqual([['borders', true]]);
    }
  });

  it('keeps illustration-rare’s glare to the shine’s region, as their shared --clip does', () => {
    // .card__glare clips to var(--clip), .card__glare2 not at all.
    const beneath = EFFECTS['illustration-rare'].beneath ?? [];
    expect(beneath.map((e) => [e.clip, e.withinRegion])).toEqual([
      [undefined, true],
      [undefined, undefined],
    ]);
  });
});

/**
 * A layer's own opacity (types.ts), as the compiler emits it: the statement
 * that blends layer 1 onto the stack, read back out of the GLSL, its weight
 * expression run as JS at chosen pointers. Two solid layers, so the stack and
 * the source are known exactly.
 */
function layerOneStatement(opacity: import('./types').PointerDriven | undefined) {
  const src = compileEffect({
    id: 'test-layer-opacity',
    shine: [
      {
        layers: [
          { source: { kind: 'solid', color: [0.2, 0.4, 0.6] }, blend: 'normal' },
          { source: { kind: 'solid', color: [1, 0.5, 0] }, blend: 'normal', opacity },
        ],
        mixBlend: 'normal',
      },
    ],
    glare: [],
  });
  const line = /^ {2}stack_shine0 = (.*);$/m.exec(src)?.[1];
  if (!line) throw new Error('layer 1 no longer writes stack_shine0 on one line');
  return line;
}

describe('a layer’s own opacity', () => {
  const weightOf = (line: string) => {
    const m =
      /^mix\(stack_shine0, blendWith\(\d+, stack_shine0, src_shine0_1\), clamp\((.*), 0\.0, 1\.0\)\)$/.exec(
        line,
      );
    if (!m) throw new Error(`not a weighted blend: ${line}`);
    const run = new Function('uPointerUV', 'uPointerFromCenter', `return ${m[1]};`) as (
      uv: { x: number; y: number },
      fromCenter: number,
    ) => number;
    return (x: number, y: number, fromCenter = 0) =>
      Math.min(1, Math.max(0, run({ x, y }, fromCenter)));
  };

  it('mixes the blended layer in at its opacity: a quarter of it over three quarters of the stack', () => {
    const weight = weightOf(layerOneStatement({ base: 0.25 }));
    const [stack, source] = [
      [0.2, 0.4, 0.6],
      [1, 0.5, 0],
    ];
    const w = weight(0.5, 0.5);
    expect(w).toBeCloseTo(0.25, 12);
    // normal blend: blendWith gives the source, so the result is the plain mix
    const mixed = stack.map((s, i) => s + (source[i] - s) * w);
    [0.4, 0.425, 0.45].forEach((want, i) => expect(mixed[i]).toBeCloseTo(want, 12));
  });

  it('follows the pointer: cosmos-holo’s :after, opaque at the top and a quarter at the bottom', () => {
    const weight = weightOf(layerOneStatement({ base: 1, fromTop: -0.75 }));
    expect(weight(0.5, 0)).toBeCloseTo(1, 12);
    expect(weight(0.5, 1)).toBeCloseTo(0.25, 12);
    expect(weight(0.5, 0.5)).toBeCloseTo(0.625, 12);
  });

  it('clamps an opacity past 1, as CSS does', () => {
    const line = layerOneStatement({ base: 1.5 });
    expect(line).toMatch(/clamp\(.*, 0\.0, 1\.0\)\)$/);
    expect(weightOf(line)(0.5, 0.5)).toBe(1);
  });

  it('leaves a layer without one blending straight onto the stack', () => {
    expect(layerOneStatement(undefined)).toMatch(/^blendWith\(\d+, stack_shine0, src_shine0_1\)$/);
  });
});

describe('the RGBA path', () => {
  const pointer: [PointerDriven, PointerDriven] = [
    { base: 0, fromLeft: 1 },
    { base: 0, fromTop: 1 },
  ];
  const stops2: GradientStop[] = [
    { at: 0.1, color: [0, 0, 0], alpha: 0.98 },
    { at: 0.9, color: [0.95, 0.95, 0.95], alpha: 0.15 },
  ];
  const exactRadialLayer: Layer = {
    source: {
      kind: 'css-radial',
      centre: pointer,
      size: [1, 1],
      at: pointer,
      ellipse: false,
      stops: stops2,
    },
    blend: 'normal',
  };
  const solid = (c: number): Layer => ({
    source: { kind: 'solid', color: [c, c, c] },
    blend: 'normal',
  });

  it('is taken by an element with children or an exact gradient, and by nothing else', () => {
    expect(needsRGBA({ layers: [solid(0.5)], mixBlend: 'screen' })).toBe(false);
    expect(needsRGBA({ layers: [exactRadialLayer], mixBlend: 'screen' })).toBe(true);
    expect(
      needsRGBA({
        layers: [solid(0.5)],
        mixBlend: 'screen',
        children: [{ layers: [solid(1)], mixBlend: 'overlay' }],
      }),
    ).toBe(true);
  });

  const group: Element = {
    layers: [exactRadialLayer, { ...solid(0.3), blend: 'overlay' }],
    children: [
      {
        layers: [solid(0.6)],
        filter: { brightness: { base: 1.25 } },
        mixBlend: 'lighten',
        opacity: { base: 0.8 },
      },
      { layers: [solid(0.2)], mixBlend: 'overlay', clip: 'regular' },
    ],
    filter: { brightness: { base: 0.2, fromCenter: 0.3 }, contrast: { base: 2 } },
    mixBlend: 'color-dodge',
  };
  const src = compileEffect({ id: 'group', shine: [group], glare: [] });
  const at = (needle: string) => {
    const i = src.indexOf(needle);
    expect(i, needle).toBeGreaterThan(-1);
    return i;
  };

  it('starts the group transparent and composites every layer onto it, the first too', () => {
    at('  vec4 stack_shine0 = vec4(0.0);');
    at(`  stack_shine0 = compositeOver(stack_shine0, src_shine0_0, ${BLEND_ID.normal});`);
    at(`  stack_shine0 = compositeOver(stack_shine0, src_shine0_1, ${BLEND_ID.overlay});`);
  });

  it('draws each child whole, then composites it onto the group, then filters the group', () => {
    const order = [
      at('  vec4 stack_shine0_c0 = vec4(0.0);'),
      at(
        '  stack_shine0_c0.rgb = applyCssFilter(stack_shine0_c0.rgb, (1.250000), 1.000000, 1.000000);',
      ),
      at('  stack_shine0_c0.a *= clamp((0.800000), 0.0, 1.0);'),
      at(`  stack_shine0 = compositeOver(stack_shine0, stack_shine0_c0, ${BLEND_ID.lighten});`),
      at('  vec4 stack_shine0_c1 = vec4(0.0);'),
      at(
        '  stack_shine0_c1.a *= clamp(1.000000, 0.0, 1.0) * insideRect(vUv, vec4(0.098500, 0.080000, 0.528500, 0.080000));',
      ),
      at(`  stack_shine0 = compositeOver(stack_shine0, stack_shine0_c1, ${BLEND_ID.overlay});`),
      at(
        '  stack_shine0.rgb = applyCssFilter(stack_shine0.rgb, (0.200000 + 0.300000 * uPointerFromCenter), (2.000000), 1.000000);',
      ),
      at(
        `  acc = mix(acc, blendWith(${BLEND_ID['color-dodge']}, acc, stack_shine0.rgb), stack_shine0.a * clamp(1.000000 * uCardOpacity, 0.0, 1.0));`,
      ),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('writes an exact gradient’s stops premultiplied, padded to 32, and looks them up where CSS puts them', () => {
    at(
      '  vec4 stops_shine0_0[MAX_CSS_STOPS] = vec4[MAX_CSS_STOPS](vec4(0.000000, 0.000000, 0.000000, 0.980000), vec4(0.142500, 0.142500, 0.142500, 0.150000), vec4(0.0)',
    );
    at('  float pos_shine0_0[MAX_CSS_STOPS] = float[MAX_CSS_STOPS](0.100000, 0.900000, 0.900000');
    at(
      '  vec4 src_shine0_0 = cssStops(stops_shine0_0, pos_shine0_0, 2, radialReach(vUv, vec2((0.000000 + 1.000000 * (uPointerUV.x)), (0.000000 + 1.000000 * (uPointerUV.y))), vec2(1.000000, 1.000000), vec2((0.000000 + 1.000000 * (uPointerUV.x)), (0.000000 + 1.000000 * (uPointerUV.y))), 0.0));',
    );
    const arrays = src.match(/vec4\[MAX_CSS_STOPS\]\(([^;]*)\);/)?.[1] ?? '';
    expect(arrays.split('vec4(').length - 1).toBe(32);
  });

  it('draws an older kind inside a group as opaque', () => {
    at('  vec4 src_shine0_1 = vec4(srcSolid(vec3(0.300000, 0.300000, 0.300000)), 1.0);');
  });

  it('mixes a stop that is part glow toward uCardGlow before premultiplying', () => {
    const glow = compileEffect({
      id: 'glow',
      shine: [
        {
          layers: [
            {
              source: {
                kind: 'css-radial',
                centre: pointer,
                size: [1, 1],
                at: pointer,
                ellipse: true,
                stops: [
                  { at: 0.2, color: [0.95, 0.95, 0.95] },
                  { at: 1.3, color: [0, 0, 0], glow: 1 },
                ],
              },
              blend: 'normal',
            },
          ],
          mixBlend: 'color-dodge',
        },
      ],
      glare: [],
    });
    expect(glow).toContain(
      'vec4(mix(vec3(0.000000, 0.000000, 0.000000), uCardGlow, 1.000000) * 1.000000, 1.000000)',
    );
    expect(glow).toMatch(/radialReach\(vUv, .*, 1\.0\)\);/);
  });

  it('draws css-linear along its line, wrapping a repeating one, and css-conic by turns', () => {
    const lin = compileEffect({
      id: 'lin',
      shine: [
        {
          layers: [
            {
              source: {
                kind: 'css-linear',
                repeating: true,
                line: { a: 2, b: -1, c: { base: 0.5, fromLeft: 0.3 } },
                stops: [
                  { at: 0, color: [1, 0, 0] },
                  { at: 1, color: [0, 0, 1] },
                ],
              },
              blend: 'normal',
            },
            {
              source: {
                kind: 'css-conic',
                centre: [0.5, 0.5],
                from: 0,
                stops: [
                  { at: 0, color: [1, 1, 1] },
                  { at: 1, color: [0, 0, 0] },
                ],
              },
              blend: 'overlay',
            },
          ],
          mixBlend: 'screen',
        },
      ],
      glare: [],
    });
    expect(lin).toContain(
      'cssStops(stops_shine0_0, pos_shine0_0, 2, fract((2.000000 * vUv.x + -1.000000 * vUv.y + (0.500000 + 0.300000 * (uPointerUV.x)))))',
    );
    expect(lin).toContain(
      'cssStops(stops_shine0_1, pos_shine0_1, 2, conicTurn(vUv, vec2(0.500000, 0.500000), 0.000000))',
    );
  });

  it('refuses a child with children of its own, and more stops than it holds', () => {
    const deep: Element = {
      layers: [solid(1)],
      mixBlend: 'normal',
      children: [
        {
          layers: [solid(1)],
          mixBlend: 'normal',
          children: [{ layers: [solid(1)], mixBlend: 'normal' }],
        },
      ],
    };
    expect(() => compileEffect({ id: 'deep', shine: [deep], glare: [] })).toThrow(
      /no children of its own/,
    );
    const many: GradientStop[] = Array.from({ length: 33 }, (_, i) => ({
      at: i / 32,
      color: [0, 0, 0],
    }));
    expect(() =>
      compileEffect({
        id: 'many',
        shine: [
          {
            layers: [
              {
                ...exactRadialLayer,
                source: { ...exactRadialLayer.source, stops: many } as Layer['source'],
              },
            ],
            mixBlend: 'normal',
          },
        ],
        glare: [],
      }),
    ).toThrow(/32/);
  });
});

describe('the RGBA path’s filter, CSS’s chain as Chrome applies it', () => {
  it('clamps after each function and saturates about CSS’s own luma', () => {
    // css.ts#cssFilterRGB is the twin, held there to Chrome's own readings
    expect(sourcesGLSL)
      .toContain(`vec3 applyCssFilter(vec3 c, float brightness, float contrast, float saturate) {
  c = clamp(c * brightness, 0.0, 1.0);
  c = clamp((c - 0.5) * contrast + 0.5, 0.0, 1.0);
  float l = dot(c, vec3(0.213, 0.715, 0.072));
  return clamp(mix(vec3(l), c, saturate), 0.0, 1.0);
}`);
  });

  it('leaves the RGB path on applyFilter', () => {
    const src = compileEffect({
      id: 'rgb-only',
      shine: [
        {
          layers: [{ source: { kind: 'card' }, blend: 'normal' }],
          filter: { saturate: { base: 2 } },
          mixBlend: 'overlay',
        },
      ],
      glare: [],
    });
    expect(src).toContain(
      'stack_shine0 = applyFilter(stack_shine0, 1.000000, 1.000000, (2.000000));',
    );
    expect(src.slice(src.indexOf('void main()'))).not.toContain('applyCssFilter');
  });
});

describe('a term on the card’s foil brightness', () => {
  it('compiles to uFoilBrightness, and leaves a number without it as it was', () => {
    const at = (brightness: PointerDriven) =>
      compileEffect({
        id: 'foil',
        shine: [
          {
            layers: [{ source: { kind: 'card' }, blend: 'normal' }],
            filter: { brightness },
            mixBlend: 'color-dodge',
          },
        ],
        glare: [],
      });
    expect(at({ base: 0, fromFoilBrightness: 1 })).toContain(
      'applyFilter(stack_shine0, (0.000000 + 1.000000 * uFoilBrightness), 1.000000, 1.000000)',
    );
    expect(at({ base: 0.55 })).toContain(
      'applyFilter(stack_shine0, (0.550000), 1.000000, 1.000000)',
    );
  });
});

describe('a texture with alpha', () => {
  const layer = (kind: 'illusion' | 'illusion-mask'): Layer => ({
    source: { kind, scale: 1 },
    blend: 'normal',
    size: [3, 2],
  });

  it('takes the RGBA path on its own, and keeps its alpha there', () => {
    expect(needsRGBA({ layers: [layer('illusion-mask')], mixBlend: 'darken' })).toBe(true);
    const src = compileEffect({
      id: 'mask',
      shine: [{ layers: [layer('illusion-mask')], mixBlend: 'darken' }],
      glare: [],
    });
    expect(src).toContain('vec4 src_shine0_0 = srcIllusionMask4(uv_shine0_0, 1.000000);');
  });

  it('leaves an opaque texture opaque, on either path', () => {
    expect(needsRGBA({ layers: [layer('illusion')], mixBlend: 'darken' })).toBe(false);
    const src = compileEffect({
      id: 'opaque',
      shine: [
        {
          layers: [layer('illusion')],
          children: [{ layers: [layer('illusion')], mixBlend: 'overlay' }],
          mixBlend: 'darken',
        },
      ],
      glare: [],
    });
    expect(src).toContain('vec4 src_shine0_0 = vec4(srcIllusion(uv_shine0_0, 1.000000), 1.0);');
  });
});
