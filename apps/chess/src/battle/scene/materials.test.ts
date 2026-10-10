import { DataTexture, MeshPhysicalMaterial, ShaderLib, type Color } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { disposeOwned } from './dispose';
import { QI_COLOR, QI_RIM_GLSL, releaseSharedLut, sectMaterials, withQiRim } from './materials';

afterEach(() => disposeOwned());

type Shader = Parameters<MeshPhysicalMaterial['onBeforeCompile']>[0];

/** Runs a material's onBeforeCompile over three's own physical shader, as the renderer would. */
function compile(material: MeshPhysicalMaterial, uniforms: Shader['uniforms'] = {}): Shader {
  const shader = {
    uniforms,
    vertexShader: ShaderLib.physical.vertexShader,
    fragmentShader: ShaderLib.physical.fragmentShader,
  } as unknown as Shader;
  material.onBeforeCompile(
    shader,
    undefined as unknown as Parameters<MeshPhysicalMaterial['onBeforeCompile']>[1],
  );
  return shader;
}

describe('withQiRim', () => {
  it("finds both anchors in three's physical fragment shader", () => {
    // If three renames either chunk, the rim would silently vanish: the replace finds nothing.
    const source = ShaderLib.physical.fragmentShader;
    expect(source).toContain('#include <common>');
    expect(source).toContain('#include <emissivemap_fragment>');
  });

  it('declares its uniforms and adds the fresnel after the emissive map', () => {
    const shader = compile(withQiRim(new MeshPhysicalMaterial(), '#5ef2ff', 0.6));
    const frag = shader.fragmentShader;
    expect(frag).toContain('uniform vec3 uQiRim;');
    expect(frag).toContain('uniform float uQiRimStrength;');
    expect(frag.indexOf(QI_RIM_GLSL)).toBeGreaterThan(
      frag.indexOf('#include <emissivemap_fragment>'),
    );
    // Declared before use: the uniforms sit in <common>, ahead of main().
    expect(frag.indexOf('uniform vec3 uQiRim;')).toBeLessThan(frag.indexOf('void main()'));
    const u = shader.uniforms as Record<string, { value: unknown }>;
    expect((u.uQiRim.value as Color).getHexString()).toBe('5ef2ff');
    expect(u.uQiRimStrength.value).toBe(0.6);
  });

  it('lets both sects share one program', () => {
    const a = withQiRim(new MeshPhysicalMaterial(), QI_COLOR.w, 0.5);
    const b = withQiRim(new MeshPhysicalMaterial(), QI_COLOR.b, 0.8);
    expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
  });
});

describe('releaseSharedLut', () => {
  it("frees three's shared DFG lookup texture, which the rim's shader carries", () => {
    // three hands every physically based shader the same LUT (UniformsLib.envmap's dfgLUT).
    expect(ShaderLib.physical.uniforms).toHaveProperty('dfgLUT');
    const lut = new DataTexture();
    let freed = 0;
    lut.addEventListener('dispose', () => freed++);
    // The renderer sets the uniform's value after compiling, as it draws.
    const dfgLUT = { value: null as DataTexture | null };
    compile(withQiRim(new MeshPhysicalMaterial(), QI_COLOR.w, 0.5), { dfgLUT });
    dfgLUT.value = lut;
    releaseSharedLut();
    expect(freed).toBe(1);
    // Again (a second lost context, say): harmless.
    releaseSharedLut();
    expect(freed).toBe(2);
  });
});

describe('sectMaterials', () => {
  it('dresses each sect in its colours', () => {
    expect(QI_COLOR).toEqual({ w: '#5ef2ff', b: '#ff3355' });
    const w = sectMaterials('w');
    const b = sectMaterials('b');
    expect(w.body.color.getHexString()).toBe('eef6ef');
    expect(b.body.color.getHexString()).toBe('15181d');
    expect(w.trim.color.getHexString()).toBe('d8b45a');
    expect(b.trim.color.getHexString()).toBe('8a5a35');
    for (const [side, m] of [
      ['w', w],
      ['b', b],
    ] as const) {
      expect(m.glow.color.getHexString()).toBe(QI_COLOR[side].slice(1));
      expect(m.qi.color.getHexString()).toBe(QI_COLOR[side].slice(1));
      expect(m.trim.metalness).toBe(1);
      expect(m.body.envMap).toBe(m.trim.envMap);
    }
  });

  it('keeps the glow additive and the qi solid', () => {
    const { glow, qi } = sectMaterials('w');
    expect(glow.transparent).toBe(true);
    expect(glow.depthWrite).toBe(false);
    expect(qi.transparent).toBe(false);
  });

  it('is built once per sect and handed to the battle for disposal', () => {
    const first = sectMaterials('b');
    expect(sectMaterials('b')).toBe(first);
    expect(sectMaterials('w')).not.toBe(first);
    const freed: string[] = [];
    for (const [name, m] of Object.entries(first)) {
      m.addEventListener('dispose', () => freed.push(name));
    }
    let envFreed = false;
    first.body.envMap?.addEventListener('dispose', () => {
      envFreed = true;
    });
    disposeOwned();
    expect(freed.sort()).toEqual(Object.keys(first).sort());
    expect(envFreed).toBe(true);
    expect(sectMaterials('b')).not.toBe(first);
  });
});
