import { describe, expect, it } from 'vitest';
import { buildMaterial, createMaterial } from './material';
import type { Layer } from './shader/types';

/** Every `uniform <type> <name>;` declaration in a compiled fragment shader. */
function declaredUniforms(source: string): string[] {
  return Array.from(
    source.matchAll(/uniform\s+\w+\s+(\w+)\s*(?:\[[^\]]*\])?\s*;/g),
    (match) => match[1],
  );
}

describe('createMaterial', () => {
  it('gives every call a material of its own, uniforms included', () => {
    // Two scenes on one effect used to share one material, and so the very
    // same uniform objects: the last scene to write uClipRect or uPointer won.
    const a = createMaterial('regular-holo');
    const b = createMaterial('regular-holo');
    expect(a).not.toBeNull();
    expect(a).not.toBe(b);
    expect(a?.uniforms.uClipRect.value).not.toBe(b?.uniforms.uClipRect.value);
    expect(a?.uniforms.uPointer.value).not.toBe(b?.uniforms.uPointer.value);
    // Writing one leaves the other alone.
    a?.uniforms.uClipRect.value.set(0.1, 0.2, 0.3, 0.4);
    expect(b?.uniforms.uClipRect.value.toArray()).toEqual([0, 0, 0, 0]);
  });

  it('returns a material for a known effect', () => {
    const m = createMaterial('basic');
    expect(m).not.toBeNull();
    expect(m?.fragmentShader).toContain('void main()');
  });

  it('gives different effects different programs', () => {
    const a = createMaterial('regular-holo');
    const b = createMaterial('cosmos-holo');
    expect(a?.fragmentShader).not.toBe(b?.fragmentShader);
  });

  it('declares every uniform the generated shaders reference', () => {
    // Derived from each effect's own compiled source rather than restated as
    // a fixed list — a fixed list still passes if a new uniform is added to
    // the GLSL and forgotten in material.ts's `buildMaterial()`, which is
    // exactly the failure this test is named for. Looped over more than one
    // effect to guard against a future uniform that only some effect emits —
    // today every effect's declared uniforms come from the same shared
    // baseGLSL + sourcesGLSL that compile.ts splices into all of them
    // unconditionally, so basic and cosmos-holo currently declare an
    // identical set.
    for (const id of ['basic', 'cosmos-holo'] as const) {
      const m = createMaterial(id);
      const declared = declaredUniforms(m?.fragmentShader ?? '');
      // A regex that matched nothing would make the loop below vacuously
      // pass even if material.ts provided zero uniforms, so assert it
      // actually found declarations before trusting it found them all.
      expect(declared.length, `${id}: found uniform declarations`).toBeGreaterThan(0);
      for (const name of declared) {
        expect(m?.uniforms, `${id}: ${name}`).toHaveProperty(name);
      }
    }
  });

  it('provides the samplers an effect using the generated SV textures declares', () => {
    // Neither effect above samples these, so neither would notice if one went
    // missing the day uniform declarations stop being shared by every shader,
    // and no registered effect samples all six: each ball effect samples only
    // its own pair (effects/sv-effects.test.ts). Build a material for an effect
    // that samples all six instead.
    const kinds = [
      'iri',
      'birthday',
      'pokeball',
      'pokeball-inner',
      'masterball',
      'masterball-inner',
    ] as const;
    const layers: Layer[] = kinds.map((kind, i) => ({
      source: { kind, scale: 2 },
      blend: i === 0 ? 'normal' : 'multiply',
    }));
    const material = buildMaterial({
      id: 'sv-textures',
      shine: [{ layers, mixBlend: 'plus-lighter' }],
      glare: [],
    });
    const declared = declaredUniforms(material.fragmentShader);
    for (const uniform of [
      'uIri',
      'uBirthday',
      'uPokeball',
      'uPokeballInner',
      'uMasterball',
      'uMasterballInner',
    ]) {
      expect(declared, uniform).toContain(uniform);
    }
    for (const name of declared) expect(material.uniforms, name).toHaveProperty(name);
    material.dispose();
  });

  it('falls back to basic when an effect cannot be compiled', () => {
    // An id outside the registry makes compileEffect throw on an undefined effect.
    const m = createMaterial('does-not-exist' as Parameters<typeof createMaterial>[0]);
    expect(m).not.toBeNull();
    expect(m?.fragmentShader).toBe(createMaterial('basic')?.fragmentShader);
  });
});
