import { describe, expect, it } from 'vitest';
import { SOURCE_ID, sourcesGLSL, uvTransform } from './sources';

describe('uvTransform', () => {
  it('returns uv unchanged at size 1 and no offset', () => {
    expect(uvTransform([0.25, 0.75], [1, 1], [0, 0])).toEqual([0.25, 0.75]);
  });

  it('scales around the origin so a size of 2 repeats twice', () => {
    expect(uvTransform([0.5, 0.5], [2, 2], [0, 0])).toEqual([1, 1]);
  });

  it('shifts by the offset', () => {
    const [x, y] = uvTransform([0.5, 0.5], [1, 1], [0.25, -0.25]);
    expect(x).toBeCloseTo(0.75, 6);
    expect(y).toBeCloseTo(0.25, 6);
  });

  it('composes scale then offset, in that order', () => {
    const [x, y] = uvTransform([0.5, 0.5], [4, 2], [0.1, 0.2]);
    expect(x).toBeCloseTo(2.1, 6);
    expect(y).toBeCloseTo(1.2, 6);
  });
});

describe('SOURCE_ID', () => {
  it('gives every source kind a distinct integer', () => {
    const ids = Object.values(SOURCE_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every kind the DSL can express', () => {
    for (const kind of [
      'solid',
      'repeating-linear',
      'linear',
      'radial-pointer',
      'conic',
      'glitter',
      'grain',
      'card',
      'scanlines',
      'iri',
      'birthday',
      'pokeball',
      'pokeball-inner',
      'masterball',
      'masterball-inner',
      'css-linear',
      'css-radial',
      'css-conic',
      'geometric',
      'trainerbg',
      'illusion',
      'illusion-mask',
      'ancient',
      'vmaxbg',
    ]) {
      expect(SOURCE_ID).toHaveProperty(kind);
    }
  });
});

describe('sourcesGLSL', () => {
  it('declares a sampler for each source kind', () => {
    for (const fn of [
      'srcSolid',
      'srcRepeatingLinear',
      'srcLinear',
      'srcRadialPointer',
      'srcConic',
      'srcGlitter',
      'srcGrain',
      'srcCard',
      'srcScanlines',
    ]) {
      expect(sourcesGLSL).toContain(fn);
    }
  });

  it('samples each generated texture through its own uniform, and declares it', () => {
    // A sampler copied from the line above and left reading its neighbour's
    // uniform compiles and links, and renders the wrong texture; one reading
    // an undeclared uniform fails only on a GPU.
    const samplers = {
      srcGlitter: 'uGlitter',
      srcGrain: 'uGrain',
      srcIri: 'uIri',
      srcBirthday: 'uBirthday',
      srcPokeball: 'uPokeball',
      srcPokeballInner: 'uPokeballInner',
      srcMasterball: 'uMasterball',
      srcMasterballInner: 'uMasterballInner',
    };
    for (const [sampler, uniform] of Object.entries(samplers)) {
      const body = new RegExp(`vec3 ${sampler}\\(vec2 uv, float scale\\) \\{([^}]*)\\}`).exec(
        sourcesGLSL,
      )?.[1];
      const read = Array.from(body?.matchAll(/texture\((\w+),/g) ?? [], (m) => m[1]);
      expect(read, sampler).toEqual([uniform]);
      expect(sourcesGLSL, uniform).toContain(`uniform sampler2D ${uniform};`);
    }
  });

  it('declares the uv transform and the filter helper', () => {
    expect(sourcesGLSL).toContain('uvTransform');
    expect(sourcesGLSL).toContain('applyFilter');
  });

  it('is balanced source', () => {
    expect((sourcesGLSL.match(/\{/g) ?? []).length).toBe((sourcesGLSL.match(/\}/g) ?? []).length);
    expect((sourcesGLSL.match(/\(/g) ?? []).length).toBe((sourcesGLSL.match(/\)/g) ?? []).length);
  });
});
