import { describe, expect, it } from 'vitest';
import { disposeMaterials, getMaterial } from './program-cache';

/** Every `uniform <type> <name>;` declaration in a compiled fragment shader. */
function declaredUniforms(source: string): string[] {
  return Array.from(
    source.matchAll(/uniform\s+\w+\s+(\w+)\s*(?:\[[^\]]*\])?\s*;/g),
    (match) => match[1],
  );
}

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
    // Derived from each effect's own compiled source rather than restated as
    // a fixed list — a fixed list still passes if a new uniform is added to
    // the GLSL and forgotten in program-cache.ts's `build()`, which is
    // exactly the failure this test is named for. Looped over more than one
    // effect to guard against a future uniform that only some effect emits —
    // today every effect's declared uniforms come from the same shared
    // baseGLSL + sourcesGLSL that compile.ts splices into all of them
    // unconditionally, so basic and cosmos-holo currently declare an
    // identical set.
    for (const id of ['basic', 'cosmos-holo'] as const) {
      const m = getMaterial(id);
      const declared = declaredUniforms(m?.fragmentShader ?? '');
      // A regex that matched nothing would make the loop below vacuously
      // pass even if program-cache.ts provided zero uniforms, so assert it
      // actually found declarations before trusting it found them all.
      expect(declared.length, `${id}: found uniform declarations`).toBeGreaterThan(0);
      for (const name of declared) {
        expect(m?.uniforms, `${id}: ${name}`).toHaveProperty(name);
      }
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
