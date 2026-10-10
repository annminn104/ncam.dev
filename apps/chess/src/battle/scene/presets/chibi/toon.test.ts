import { BackSide, type DataTexture, NearestFilter } from 'three';
import { describe, expect, it } from 'vitest';
import { disposeOwned } from '../../dispose';
import { FIGURINE_GLSL, accentMaterial, outlineMaterial, toonMaterial } from './toon';

describe('chibi materials', () => {
  it('share one toon material: vertex colours over three nearest-filtered light bands', () => {
    const m = toonMaterial();
    expect(toonMaterial()).toBe(m);
    expect(m.vertexColors).toBe(true);
    const bands = m.gradientMap as DataTexture;
    expect(Array.from(bands.image.data ?? [])).toEqual([90, 175, 255]);
    expect([bands.minFilter, bands.magFilter]).toEqual([NearestFilter, NearestFilter]);
  });

  it("add the figurine's fill and sheen right after three's emissive map", () => {
    const shader = { fragmentShader: 'a\n#include <emissivemap_fragment>\nb' };
    toonMaterial().onBeforeCompile(shader as never, undefined as never);
    expect(shader.fragmentShader).toBe(`a\n#include <emissivemap_fragment>\n${FIGURINE_GLSL}\nb`);
    expect(Object.keys(toonMaterial().defines ?? {}).sort()).toEqual(['FIG_FILL', 'FIG_SHEEN']);
  });

  it('outline back faces, one material per ink', () => {
    const ink = outlineMaterial('#2a2d3a');
    expect(outlineMaterial('#2a2d3a')).toBe(ink);
    expect(outlineMaterial('#0d0d12')).not.toBe(ink);
    expect(ink.side).toBe(BackSide);
    expect(ink.color.getHexString()).toBe('2a2d3a');
  });

  it('light the accents unlit, past the tone mapping', () => {
    const a = accentMaterial();
    expect(accentMaterial()).toBe(a);
    expect(a.vertexColors).toBe(true);
    expect(a.toneMapped).toBe(false);
  });

  it('are made afresh once the battle has freed them', () => {
    const before = [toonMaterial(), outlineMaterial('#000000'), accentMaterial()];
    disposeOwned();
    const after = [toonMaterial(), outlineMaterial('#000000'), accentMaterial()];
    after.forEach((m, i) => expect(m).not.toBe(before[i]));
  });
});
