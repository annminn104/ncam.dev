import { describe, expect, it } from 'vitest';
import { compileEffect, VERTEX_SHADER } from './compile';
import { baseGLSL } from './base';
import { coversPoint, regionFor, SHAPE_ID, STAGE_STEP, type RegionRect } from '../regions';
import type { ClipShape } from '../select';
import {
  BACKGROUND_X,
  BACKGROUND_Y,
  BLACK,
  CENTER,
  WHITE,
  radial,
  radialT,
  stop,
  valueAt,
  type CssBox,
} from '../effects/css';
import { sourcesGLSL } from './sources';
import type { Effect } from './types';

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

  it('takes the stage cut-out constants from regions.ts, not its own literals', () => {
    // base.ts used to hardcode 0.57/0.16 while regions.ts owned the same pair
    // for coversPoint. Editing either alone left the suite green with the CPU
    // and GPU clips silently disagreeing.
    const src = compileEffect(minimal);
    const x = /const float STAGE_STEP_X = ([0-9.]+);/.exec(src);
    const y = /const float STAGE_STEP_Y = ([0-9.]+);/.exec(src);
    expect(x).not.toBeNull();
    expect(y).not.toBeNull();
    expect(Number(x?.[1])).toBe(STAGE_STEP.x);
    expect(Number(y?.[1])).toBe(STAGE_STEP.y);
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
  const consts = glsl.match(/const float STAGE_STEP_[XY] = [^;]+;/g) ?? [];
  const body = /float coverage\(vec2 uv\) \{\n([\s\S]*?)\n\}/.exec(glsl)?.[1];
  if (consts.length !== 2 || !body) {
    throw new Error('coverage() no longer has the shape this translation assumes');
  }

  const js = [...consts, body]
    .join('\n')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/const float /g, 'const ')
    .replace(/\bfloat /g, 'let ')
    .replace(/uClipRect\.x/g, 'rect.top')
    .replace(/uClipRect\.y/g, 'rect.right')
    .replace(/uClipRect\.z/g, 'rect.bottom')
    .replace(/uClipRect\.w/g, 'rect.left')
    .replace(/uClipShape/g, 'shapeId')
    .replace(/uInvert/g, 'invert')
    .replace(/ == /g, ' === ');

  // A translation that quietly left GLSL behind would be a twin all over
  // again, so fail loudly rather than evaluate something half-converted.
  expect(js).not.toMatch(/\bu[A-Z]\w*/);
  expect(js).not.toMatch(/\b(?:float|vec[234]|uniform)\b/);

  const step = (edge: number, v: number) => (v >= edge ? 1 : 0);
  const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  const compiled = new Function('uv', 'rect', 'shapeId', 'invert', 'step', 'mix', js) as (
    uv: { x: number; y: number },
    rect: RegionRect,
    shapeId: number,
    invert: number,
    step: (edge: number, v: number) => number,
    mix: (a: number, b: number, t: number) => number,
  ) => number;

  return (shape: ClipShape, x: number, y: number, invert: boolean) =>
    compiled({ x, y }, regionFor(shape), SHAPE_ID[shape], invert ? 1 : 0, step, mix);
}

describe('coverage() in GLSL agrees with coversPoint() in JS', () => {
  const coverage = transpileCoverage(baseGLSL);
  const shapes: ClipShape[] = ['full', 'regular', 'stage', 'trainer', 'borders'];
  // Deliberately offset off the round numbers so no sample lands exactly on an
  // inset edge: float equality on the boundary is not what this pins.
  const axis = Array.from({ length: 21 }, (_, i) => (i / 20) * 0.98 + 0.011);

  for (const shape of shapes) {
    for (const invert of [false, true]) {
      it(`agrees across the card for ${shape}${invert ? ', inverted' : ''}`, () => {
        const disagreements: string[] = [];
        for (const x of axis) {
          for (const y of axis) {
            const gpu = coverage(shape, x, y, invert) > 0.5;
            const cpu = coversPoint(shape, x, y, invert);
            if (gpu !== cpu) {
              disagreements.push(`(${x.toFixed(3)}, ${y.toFixed(3)}) gpu=${gpu} cpu=${cpu}`);
            }
          }
        }
        expect(disagreements).toEqual([]);
      });
    }
  }

  it('actually exercises both verdicts, so agreement is not vacuous', () => {
    // A coverage() stuck at a constant would "agree" with nothing to compare.
    expect(coverage('regular', 0.5, 0.3, false)).toBe(1);
    expect(coverage('regular', 0.5, 0.8, false)).toBe(0);
    expect(coverage('regular', 0.5, 0.8, true)).toBe(1);
  });
});

/**
 * A css.ts radial's distance as the shader works it out (sources.ts's
 * radialCssDistance), translated from the GLSL itself and held to css.ts's
 * radialT, the twin css.test.ts holds to CSS's own farthest-corner geometry.
 */
function transpileRadialCss(glsl: string) {
  const body = /float radialCssDistance\(vec2 uv, vec2 centre, vec2 size\) \{\n([\s\S]*?)\n\}/.exec(
    glsl,
  )?.[1];
  const aspect = /const float CARD_HEIGHT_OVER_WIDTH = ([^;]+);/.exec(glsl)?.[1];
  if (!body || !aspect) {
    throw new Error('radialCssDistance() no longer has the shape this translation assumes');
  }
  const js = body
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\bfloat /g, 'let ')
    .replace(/uPointerUV/g, 'pointer')
    .replace(/CARD_HEIGHT_OVER_WIDTH/g, String(Number(aspect)));
  expect(js).not.toMatch(/\bu[A-Z]\w*/);
  expect(js).not.toMatch(/\b(?:float|vec[234]|uniform)\b/);
  type V = { x: number; y: number };
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  // every GLSL built-in the function could reach for, so a mutant fails on its values
  const run = new Function(
    'uv',
    'centre',
    'size',
    'pointer',
    'min',
    'max',
    'sqrt',
    'clamp',
    js,
  ) as (
    ...args: [V, V, V, V, typeof Math.min, typeof Math.max, typeof Math.sqrt, typeof clamp]
  ) => number;
  return (uv: V, centre: V, size: V, pointer: V) =>
    run(uv, centre, size, pointer, Math.min, Math.max, Math.sqrt, clamp);
}

describe('a converted radial’s reach in GLSL agrees with radialT() in JS', () => {
  const distance = transpileRadialCss(sourcesGLSL);
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
});
