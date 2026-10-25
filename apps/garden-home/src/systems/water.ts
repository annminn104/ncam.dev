import { Color, type Material, ShaderMaterial } from 'three';
import { globalUniforms } from './uniforms';

/** The pool's colours, mixed by its ripples. */
export const WATER_SHALLOW = new Color('#6cc4b8');
export const WATER_DEEP = new Color('#1d5a73');

/**
 * How a WATER_* mesh looks: its two colours, its opacity, how strongly its ripples show, how white its falling water
 * is.
 */
export interface WaterStyle {
  shallow: Color;
  deep: Color;
  opacity: number;
  /** 1: the pool's ripples in full; less: calmer water (falling water always streaks in full) */
  ripple: number;
  /** how far falling water whitens: 0 for the pool's fountain and showers */
  whiteFall: number;
}

/**
 * The styles a WATER_* node's extras may name (`water`): the pool's by default, also the jacuzzi, the wall fountain and
 * the showers; the koi pond's (villa v2 part 3) darker, greener and calmer, so the koi drawn over it read orange from
 * the wallpaper camera (systems/koi.ts tints them with it), and its waterfall whiter.
 */
export const WATER_STYLES: Readonly<Record<'pool' | 'pond', WaterStyle>> = {
  pool: { shallow: WATER_SHALLOW, deep: WATER_DEEP, opacity: 0.7, ripple: 1, whiteFall: 0 },
  pond: {
    shallow: new Color('#4c8a68'),
    deep: new Color('#12362d'),
    opacity: 0.72,
    ripple: 0.35,
    whiteFall: 0.5,
  },
};

/**
 * At full night falling water whitens only `white` of its day white, and the foam at its foot keeps `foam` of its
 * colour: the pond's waterfall reads as moonlit water on the dark rock, not as a pale lit panel.
 */
export const FALL_NIGHT = { white: 0.25, foam: 0.45 };

/** The style a WATER_* node's extras name, the pool's when they name none or one there is not. */
export function waterStyle(name: unknown): WaterStyle {
  if (name === undefined) return WATER_STYLES.pool;
  if (name === 'pool' || name === 'pond') return WATER_STYLES[name];
  console.warn(`[water] unknown water style ${String(name)}, the pool's instead`);
  return WATER_STYLES.pool;
}

/**
 * Stylised water for WATER_* meshes: moving ripples on level water, streaks sliding down a vertical sheet (a wall
 * fountain, a running shower, the pond's waterfall), darker at night, in a WaterStyle. It clips at the material's
 * clipping planes like the built-in materials (the house's dollhouse cutaway, interaction spec §2).
 */
export function createWaterMaterial(style: WaterStyle = WATER_STYLES.pool): ShaderMaterial {
  return new ShaderMaterial({
    name: 'water',
    transparent: true,
    depthWrite: false,
    clipping: true,
    uniforms: {
      uTime: globalUniforms.uTime,
      uNight: globalUniforms.uNight,
      uShallow: { value: style.shallow.clone() },
      uDeep: { value: style.deep.clone() },
      uOpacity: { value: style.opacity },
      uRipple: { value: style.ripple },
      uWhiteFall: { value: style.whiteFall },
    },
    vertexShader: /* glsl */ `
      #include <clipping_planes_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <clipping_planes_pars_fragment>
      uniform float uTime;
      uniform float uNight;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform float uOpacity;
      uniform float uRipple;
      uniform float uWhiteFall;
      varying vec3 vWorld;
      void main() {
        #include <clipping_planes_fragment>
        float ripple = sin(vWorld.x * 6.0 + uTime * 1.5) * sin(vWorld.z * 5.0 - uTime * 1.2);
        // Faces steeper than 60 degrees fall: fine streaks across the sheet and bands sliding down it. The slope is
        // |n.y| < cos(60 deg) * |n| on the derivative cross product n, compared squared: n can be zero (a degenerate
        // or edge-on fragment) and must not be normalised; such a fragment keeps the level ripples.
        vec3 n = cross(dFdx(vWorld), dFdy(vWorld));
        bool falling = n.y * n.y < 0.25 * dot(n, n);
        float across = vWorld.x + vWorld.z;
        float fall = 0.35 * sin(across * 23.0) + 0.65 * sin(vWorld.y * 7.0 + uTime * 5.0 + 1.5 * sin(across * 9.0));
        ripple = falling ? fall : ripple * uRipple;
        vec3 color = mix(uDeep, uShallow, 0.5 + 0.5 * ripple);
        color += smoothstep(0.8, 1.0, ripple) * 0.12;
        float white = uWhiteFall * mix(1.0, ${FALL_NIGHT.white.toFixed(2)}, uNight);
        color = falling ? mix(color, vec3(0.92, 0.96, 1.0), white * (0.75 + 0.25 * fall)) : color;
        color *= mix(1.0, 0.3, uNight);
        gl_FragColor = vec4(color, falling ? max(uOpacity, 0.7 + 0.25 * white) : uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * The foam at the foot of falling water (a *_foam node: the pond's waterfall) dims with the night like the water's
 * white (FALL_NIGHT.foam), so it does not glow white under the moon. Patches the material in place: a module's clones
 * share it, and patching it again changes nothing.
 */
export function applyFoamNight(material: Material): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = globalUniforms.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>\n  diffuseColor.rgb *= mix(1.0, ${FALL_NIGHT.foam.toFixed(2)}, uNight);`,
      );
  };
  material.customProgramCacheKey = () => 'foam-night';
  material.needsUpdate = true;
}
