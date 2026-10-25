import { describe, expect, it } from 'vitest';
import { Color, MeshStandardMaterial, ShaderLib } from 'three';
import { globalUniforms } from './uniforms';
import { applyFoamNight, createWaterMaterial, FALL_NIGHT, WATER_STYLES } from './water';

describe('createWaterMaterial', () => {
  it('ripples level water across x and z', () => {
    const { fragmentShader } = createWaterMaterial();
    expect(fragmentShader).toContain(
      'sin(vWorld.x * 6.0 + uTime * 1.5) * sin(vWorld.z * 5.0 - uTime * 1.2)',
    );
  });

  it('streams a vertical sheet of water downwards instead (a wall fountain)', () => {
    const { fragmentShader } = createWaterMaterial();
    // the slope of the face from the derivatives of its world position: robust to quantized, scaled nodes
    expect(fragmentShader).toContain('cross(dFdx(vWorld), dFdy(vWorld))');
    // bands across the sheet whose phase grows with time along +y: they slide down
    expect(fragmentShader).toMatch(/sin\(vWorld\.y \* \d+\.\d+ \+ uTime \* \d+\.\d+/);
  });

  it('compares squared lengths for the slope: the derivative cross product can be zero and is never normalised', () => {
    const { fragmentShader } = createWaterMaterial();
    expect(fragmentShader).not.toMatch(/normalize\(\s*cross/);
    // |n.y| < cos(60 deg) * |n|, squared: a degenerate (zero) normal is not steep, so it keeps the level ripples
    expect(fragmentShader).toContain('n.y * n.y < 0.25 * dot(n, n)');
  });

  it('clips at clipping planes like the standard materials (the dollhouse cutaway, interaction spec §2)', () => {
    const water = createWaterMaterial();
    expect(water.clipping).toBe(true);
    expect(water.vertexShader).toContain('#include <clipping_planes_pars_vertex>');
    expect(water.vertexShader).toContain('#include <clipping_planes_vertex>');
    expect(water.fragmentShader).toContain('#include <clipping_planes_pars_fragment>');
    expect(water.fragmentShader).toContain('#include <clipping_planes_fragment>');
  });
});

describe('water styles', () => {
  const value = (material: ReturnType<typeof createWaterMaterial>, name: string) =>
    material.uniforms[name].value;

  it('keeps the pool, the jacuzzi and the fountain as they were by default', () => {
    const water = createWaterMaterial();
    expect(value(water, 'uShallow')).toEqual(new Color('#6cc4b8'));
    expect(value(water, 'uDeep')).toEqual(new Color('#1d5a73'));
    expect([value(water, 'uOpacity'), value(water, 'uRipple'), value(water, 'uWhiteFall')]).toEqual(
      [0.7, 1, 0],
    );
    // no white for the pool's falling water, so its opacity stays max(uOpacity, 0.7) by night as by day
    expect(water.fragmentShader).toContain(
      'gl_FragColor = vec4(color, falling ? max(uOpacity, 0.7 + 0.25 * white) : uOpacity);',
    );
  });

  it('gives the koi pond a darker, greener, calmer water and a whiter waterfall', () => {
    const pond = createWaterMaterial(WATER_STYLES.pond);
    const pool = WATER_STYLES.pool;
    for (const key of ['uShallow', 'uDeep'] as const) {
      const colour = value(pond, key) as Color;
      expect(colour.g).toBeGreaterThan(colour.b); // green, not the pool's blue
    }
    expect((value(pond, 'uDeep') as Color).getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(
      pool.deep.getHSL({ h: 0, s: 0, l: 0 }).l,
    );
    expect(value(pond, 'uRipple')).toBeLessThan(0.6); // ripples a little: no pool-tile pattern over the koi
    expect(value(pond, 'uWhiteFall')).toBeGreaterThan(0.3); // a waterfall reads as white water
    expect(pond.fragmentShader).toContain('uRipple');
    expect(pond.fragmentShader).toMatch(/falling \? mix\(color, vec3\([^)]*\), white/);
  });

  it('dims the white of the waterfall at night, so it reads as moonlit water and not as a pale panel on the dark rock', () => {
    const pond = createWaterMaterial(WATER_STYLES.pond);
    expect(FALL_NIGHT.white).toBeLessThan(0.4);
    expect(pond.fragmentShader).toContain(
      `float white = uWhiteFall * mix(1.0, ${FALL_NIGHT.white.toFixed(2)}, uNight);`,
    );
    expect(pond.uniforms.uNight).toBe(globalUniforms.uNight);
  });
});

describe('applyFoamNight', () => {
  it('dims the foam at the foot of falling water with the night, as the white of the water', () => {
    const foam = new MeshStandardMaterial({ color: 0xf2f6f8 });
    applyFoamNight(foam);
    expect(foam.customProgramCacheKey()).toBe('foam-night');
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: ShaderLib.physical.vertexShader,
      fragmentShader: ShaderLib.physical.fragmentShader,
    };
    foam.onBeforeCompile(shader as never, null as never);
    expect(shader.uniforms.uNight).toBe(globalUniforms.uNight);
    expect(FALL_NIGHT.foam).toBeLessThan(0.6);
    expect(shader.fragmentShader).toMatch(
      new RegExp(
        `#include <color_fragment>\\s*diffuseColor\\.rgb \\*= mix\\(1\\.0, ${FALL_NIGHT.foam.toFixed(2)}, uNight\\);`,
      ),
    );
    expect(() => applyFoamNight(foam)).not.toThrow(); // a second module clone shares the material: no harm
  });
});
