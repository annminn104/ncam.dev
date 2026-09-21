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

  it('declares the uv transform and the filter helper', () => {
    expect(sourcesGLSL).toContain('uvTransform');
    expect(sourcesGLSL).toContain('applyFilter');
  });

  it('is balanced source', () => {
    expect((sourcesGLSL.match(/\{/g) ?? []).length).toBe((sourcesGLSL.match(/\}/g) ?? []).length);
    expect((sourcesGLSL.match(/\(/g) ?? []).length).toBe((sourcesGLSL.match(/\)/g) ?? []).length);
  });
});
