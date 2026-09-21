import { describe, expect, it } from 'vitest';
import { compileEffect, VERTEX_SHADER } from './compile';
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
  it('passes uv through and is balanced', () => {
    expect(VERTEX_SHADER).toContain('vUv');
    expect(VERTEX_SHADER).toContain('gl_Position');
    expect((VERTEX_SHADER.match(/\{/g) ?? []).length).toBe(
      (VERTEX_SHADER.match(/\}/g) ?? []).length,
    );
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

  it('applies the clip coverage before writing the fragment', () => {
    const src = compileEffect(minimal);
    expect(src).toContain('coverage');
    expect(src).toContain('uInvert');
  });

  it('handles every source kind without throwing', () => {
    // All 9 Source['kind'] variants (SOURCE_ID order) — repeating-linear,
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
