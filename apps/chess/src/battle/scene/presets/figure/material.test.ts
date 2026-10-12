import {
  BackSide,
  type Color,
  type DataTexture,
  LinearFilter,
  MeshToonMaterial,
  ShaderLib,
  type MeshBasicMaterial,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeOwned } from '../../dispose';
import { inject, L_MIN, outlineMaterial, paintMaterial } from './material';

/** Runs a material's hook over three's own shader sources for its kind, as the renderer would. */
function compile(material: MeshToonMaterial | MeshBasicMaterial) {
  const lib = material instanceof MeshToonMaterial ? ShaderLib.toon : ShaderLib.basic;
  const shader = {
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
    uniforms: {},
  } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader;
}

const palette = (shader: WebGLProgramParametersWithUniforms) =>
  shader.uniforms.figurePalette.value as Color[];

describe('figure materials', () => {
  it('paint each side from its own palette', () => {
    const white = compile(paintMaterial('holy-order', 'w'));
    const black = compile(paintMaterial('holy-order', 'b'));
    expect(palette(white)).toHaveLength(22);
    // Slot 3 is 'main': white robes against black ones.
    expect(palette(white)[3].getHexString()).toBe('f4f6fb');
    expect(palette(black)[3].getHexString()).toBe('1c1d24');
  });

  it("land every hook in three's toon shader", () => {
    const { vertexShader, fragmentShader } = compile(paintMaterial('holy-order', 'w'));
    expect(vertexShader).toContain('vAlbedo = figurePalette[int(_slot + 0.5)];');
    expect(fragmentShader).toContain('diffuseColor.rgb = vAlbedo;');
    expect(fragmentShader).toContain('figureGoldRamp(f * 0.5 + 0.5)');
    expect(fragmentShader).toContain(`max(lit, ${L_MIN})`);
    // The slot shading runs after three's lighting and before its output.
    const shading = fragmentShader.indexOf('figureGoldRamp(f * 0.5');
    expect(fragmentShader.indexOf('vec3 outgoingLight')).toBeLessThan(shading);
    expect(shading).toBeLessThan(fragmentShader.indexOf('#include <opaque_fragment>'));
  });

  it('shade with a plain grey toon step: three reads only its red channel', () => {
    const ramp = paintMaterial('holy-order', 'w').gradientMap as DataTexture;
    expect([ramp.image.width, ramp.image.height]).toEqual([32, 1]);
    expect(ramp.magFilter).toBe(LinearFilter);
    expect(ramp.minFilter).toBe(LinearFilter);
    const bytes = Array.from(ramp.image.data ?? []);
    expect(bytes).toHaveLength(32 * 4);
    const texel = (i: number) => bytes.slice(i * 4, i * 4 + 4);
    // The shadow is 0.42 (round(0.42 * 255) = 107) on every channel, the light is 1.
    expect(texel(0)).toEqual([107, 107, 107, 255]);
    expect(texel(31)).toEqual([255, 255, 255, 255]);
    // three's getGradientIrradiance samples .r alone: a tint in G or B would be dead data.
    for (let i = 0; i < 32; i++) {
      const [r, g, b] = texel(i);
      expect([g, b], `texel ${i}`).toEqual([r, r]);
    }
  });

  it('draw the outline as an inverted hull, and none for decals', () => {
    const material = outlineMaterial('holy-order', 'b');
    expect(material.side).toBe(BackSide);
    const shader = compile(material);
    expect(shader.vertexShader).toContain('transformed += outlineNormal * _line;');
    expect(shader.vertexShader.indexOf('if (_line <= 0.0)')).toBeGreaterThan(
      shader.vertexShader.indexOf('#include <project_vertex>'),
    );
    expect(shader.fragmentShader).toContain('diffuseColor.rgb = vInk;');
    expect(palette(shader)[3].getHexString()).toBe('1c1d24');
  });

  it('fail loudly when three no longer has an anchor', () => {
    expect(() => inject('void main() {}', '#include <opaque_fragment>', '', 'before')).toThrow(
      /three has no #include <opaque_fragment>/,
    );
  });

  it('make one of each per preset and side, which the battle frees', () => {
    const paint = paintMaterial('holy-order', 'w');
    expect(paintMaterial('holy-order', 'w')).toBe(paint);
    expect(paintMaterial('holy-order', 'b')).not.toBe(paint);
    const free = vi.spyOn(paint, 'dispose');
    disposeOwned();
    expect(free).toHaveBeenCalledTimes(1);
    expect(paintMaterial('holy-order', 'w')).not.toBe(paint);
  });
});
