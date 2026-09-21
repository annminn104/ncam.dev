import { describe, expect, it } from 'vitest';
import { disposeMaterials, getMaterial } from './program-cache';

describe('getMaterial', () => {
  it('returns a material for a known effect', () => {
    const m = getMaterial('basic');
    expect(m).not.toBeNull();
    expect(m?.fragmentShader).toContain('void main()');
  });

  it('compiles each effect once and caches it', () => {
    disposeMaterials();
    const first = getMaterial('regular-holo');
    const second = getMaterial('regular-holo');
    expect(first).toBe(second);
  });

  it('gives different effects different programs', () => {
    disposeMaterials();
    const a = getMaterial('regular-holo');
    const b = getMaterial('cosmos-holo');
    expect(a).not.toBe(b);
    expect(a?.fragmentShader).not.toBe(b?.fragmentShader);
  });

  it('declares every uniform the generated shaders reference', () => {
    disposeMaterials();
    const m = getMaterial('cosmos-holo');
    for (const name of [
      'uCard',
      'uGlitter',
      'uGrain',
      'uPointer',
      'uPointerUV',
      'uPointerFromCenter',
      'uTime',
      'uClipRect',
      'uClipShape',
      'uInvert',
      'uCardOpacity',
    ]) {
      expect(m?.uniforms, name).toHaveProperty(name);
    }
  });

  it('falls back to basic when an effect cannot be compiled', () => {
    disposeMaterials();
    // An id outside the registry makes compileEffect throw on an undefined effect.
    const m = getMaterial('does-not-exist' as Parameters<typeof getMaterial>[0]);
    expect(m).not.toBeNull();
    expect(m).toBe(getMaterial('basic'));
  });

  it('empties the cache on dispose', () => {
    const before = getMaterial('basic');
    disposeMaterials();
    expect(getMaterial('basic')).not.toBe(before);
  });
});
