import { MeshStandardMaterial, ShaderLib } from 'three';
import { describe, expect, it } from 'vitest';
import { globalUniforms } from './uniforms';
import { applyWind, patchWindVertex } from './wind';

describe('patchWindVertex', () => {
  it('injects the attribute, uniforms and sway into the physical vertex shader', () => {
    const out = patchWindVertex(ShaderLib.physical.vertexShader);
    expect(out).toContain('attribute float windWeight;');
    expect(out).toContain('uniform float uTime;');
    expect(out).toContain('transformed.x += windSway');
  });

  it('measures phase in world space and sways in metres, not in quantized mesh units', () => {
    // Meshopt quantization stores position in [-1, 1] and puts the real size on the node scale.
    const out = patchWindVertex(ShaderLib.physical.vertexShader);
    expect(out).toContain('(modelMatrix * vec4(position, 1.0)).xyz');
    expect(out).not.toMatch(/dot\(\s*position/);
    expect(out).toContain('length(modelMatrix[0].xyz)');
    expect(out).toMatch(/transformed\.x \+= .*windMetres/);
    expect(out).toMatch(/transformed\.z \+= .*windMetres/);
  });

  it('throws when the expected chunks are missing', () => {
    expect(() => patchWindVertex('void main() {}')).toThrow(/begin_vertex/);
  });
});

describe('applyWind', () => {
  it('wires shared uniforms once and keys the program cache', () => {
    const material = new MeshStandardMaterial();
    applyWind(material);
    const hook = material.onBeforeCompile;
    applyWind(material);
    expect(material.onBeforeCompile).toBe(hook);
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: ShaderLib.physical.vertexShader,
      fragmentShader: '',
    };
    material.onBeforeCompile(shader as never, null as never);
    expect(shader.uniforms.uTime).toBe(globalUniforms.uTime);
    expect(shader.uniforms.uWind).toBe(globalUniforms.uWind);
    expect(material.customProgramCacheKey()).toBe('wind');
  });
});
