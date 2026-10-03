import {
  AdditiveBlending,
  Color,
  DataTexture,
  DataUtils,
  EquirectangularReflectionMapping,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RGBAFormat,
} from 'three';
import type { Side } from '../../game/coords';
import { onDispose, own } from './dispose';

/** Each sect's qi: the rim light on its jade and its glows (and, later, its trails and bursts). */
export const QI_COLOR: Record<Side, string> = { w: '#5ef2ff', b: '#ff3355' };

export interface SectMaterials {
  /** Jade, white for the Righteous Sect and black for the Demonic, rimmed with the sect's qi. */
  body: MeshPhysicalMaterial;
  /** The fittings: gold for the Righteous Sect, bronze for the Demonic. */
  trim: MeshStandardMaterial;
  /** Unlit, additive qi light: halos and threads, seen against whatever is behind them. */
  glow: MeshBasicMaterial;
  /**
   * Unlit, opaque qi: the solid bodies of qi (pearls, pools, flames). Additive light over white
   * jade or a pale square adds up to white; these keep the sect's colour wherever they are.
   */
  qi: MeshBasicMaterial;
}

const cache = new Map<Side, SectMaterials>();
let studio: DataTexture | null = null;
onDispose(() => {
  cache.clear();
  studio = null;
});

/**
 * GLSL run right after three's emissive map, where `normal` (view space) and `vViewPosition`
 * are in scope: a fresnel term in the qi colour, so every jade silhouette glows at its edge.
 * `vViewPosition` points from the surface to the camera, so N·V is 1 face-on and 0 at the
 * silhouette. (The plan's sketch negated the dot product, which lights every front face at full
 * strength.) The rim fades on faces turned up to the sky: a flat top seen across the board is
 * near-grazing too, and would flood with qi; the black bases would turn crimson.
 */
export const QI_RIM_GLSL = /* glsl */ `
  float qiUp = dot( normal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) );
  float qiFresnel = pow( 1.0 - saturate( dot( normalize( vViewPosition ), normal ) ), 3.0 );
  totalEmissiveRadiance += uQiRim * qiFresnel * ( 1.0 - smoothstep( 0.55, 0.9, qiUp ) ) * uQiRimStrength;`;

/** Adds the qi rim to a physical material. The colour and strength are uniforms, not code. */
export function withQiRim(
  material: MeshPhysicalMaterial,
  color: string,
  strength: number,
): MeshPhysicalMaterial {
  const uniforms = {
    uQiRim: { value: new Color(color) },
    uQiRimStrength: { value: strength },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uQiRim;\nuniform float uQiRimStrength;',
      )
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${QI_RIM_GLSL}`);
  };
  // The GLSL is the same for both sects, so they share one program.
  material.customProgramCacheKey = () => 'qi-rim';
  return material;
}

export function sectMaterials(side: Side): SectMaterials {
  const hit = cache.get(side);
  if (hit) return hit;
  const righteous = side === 'w';
  const env = studioEnvironment();
  const qi = QI_COLOR[side];
  const made: SectMaterials = {
    body: own(
      withQiRim(
        new MeshPhysicalMaterial(
          righteous
            ? {
                // Milky white jade: a soft lacquer, and a pale green sheen where it turns away.
                color: '#eef6ef',
                roughness: 0.3,
                metalness: 0,
                sheen: 0.6,
                sheenColor: new Color('#bfeedd'),
                sheenRoughness: 0.5,
                clearcoat: 0.55,
                clearcoatRoughness: 0.2,
                envMap: env,
                envMapIntensity: 1,
              }
            : {
                // Black jade is seen by its reflections: glossy, so the studio's lights draw its
                // form, over a crimson sheen and the demonic qi at its edges.
                color: '#15181d',
                roughness: 0.22,
                metalness: 0,
                sheen: 0.45,
                sheenColor: new Color('#5a1020'),
                sheenRoughness: 0.4,
                clearcoat: 0.8,
                clearcoatRoughness: 0.12,
                envMap: env,
                envMapIntensity: 0.85,
              },
        ),
        qi,
        righteous ? 0.55 : 0.8,
      ),
    ),
    trim: own(
      new MeshStandardMaterial({
        color: righteous ? '#d8b45a' : '#8a5a35',
        metalness: 1,
        roughness: righteous ? 0.3 : 0.4,
        envMap: env,
        // Metal is only what it mirrors; the studio is dim for the jade's sake, so turn it up.
        envMapIntensity: 2.6,
      }),
    ),
    glow: own(
      new MeshBasicMaterial({
        color: qi,
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
    qi: own(new MeshBasicMaterial({ color: qi, toneMapped: false })),
  };
  cache.set(side, made);
  return made;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const DEG = Math.PI / 180;

/**
 * A soft-edged light panel in the studio, by azimuth and elevation (degrees; azimuth 0 is +x,
 * 90 is +z, toward the white player). A flat top, seen from elevation e, mirrors the sky at
 * elevation e behind it, and the camera never drops below 13° (CameraRig's polar clamp), so
 * the panels keep out of the band 13–55° that flat tops would show: the key is overhead, the
 * strips stand on the horizon, where only upright faces catch them. Black jade's flat tops
 * then mirror only the dim sky and stay black.
 */
const PANELS = [
  // Key, high over the white player's right shoulder.
  { az: 35, el: 66, w: 26, h: 15, power: 7 },
  // Strips round the horizon, for long highlights down the upright faces.
  { az: 150, el: 6, w: 7, h: 11, power: 3.2 },
  { az: 20, el: 6, w: 6, h: 11, power: 2.2 },
  { az: -60, el: 6, w: 9, h: 11, power: 2.6 },
  { az: -125, el: 6, w: 6, h: 11, power: 1.6 },
].map((p) => ({ ...p, az: p.az * DEG, el: p.el * DEG, w: p.w * DEG, h: p.h * DEG }));

/** 0..1, how far inside a panel (with a soft rim of a third of its half-size) a direction is. */
function inPanel(az: number, el: number, p: (typeof PANELS)[number]): number {
  let d = Math.abs(az - p.az);
  if (d > Math.PI) d = 2 * Math.PI - d;
  const u = 1 - clamp01((d / p.w - 0.67) / 0.33);
  const v = 1 - clamp01((Math.abs(el - p.el) / p.h - 0.67) / 0.33);
  return smooth(u) * smooth(v);
}

/**
 * A small HDR studio made in code, so jade's clearcoat and the metal trim have something to
 * reflect: no arena provides an environment map, and metal with nothing to reflect is black.
 * An equirectangular half-float texture; three turns it into a PMREM on first use and frees
 * that when the texture is disposed. The arenas' lights still do the direct lighting.
 */
function studioEnvironment(): DataTexture {
  if (studio) return studio;
  const W = 128;
  const H = 64;
  const data = new Uint16Array(W * H * 4);
  for (let j = 0; j < H; j++) {
    // three's equirectUv: v = asin(y) / π + 0.5, u = atan(z, x) / 2π + 0.5; row 0 is v = 0.
    const el = ((j + 0.5) / H - 0.5) * Math.PI;
    const y = Math.sin(el);
    for (let i = 0; i < W; i++) {
      const az = ((i + 0.5) / W - 0.5) * 2 * Math.PI;
      // A dim, cool sky over a warm grey floor: metal facing down still reads as metal.
      let r: number;
      let g: number;
      let b: number;
      if (y >= 0) {
        const t = smooth(clamp01(y));
        r = 0.2 + 0.08 * t;
        g = 0.2 + 0.11 * t;
        b = 0.21 + 0.15 * t;
      } else {
        const t = smooth(clamp01(-y * 2.5));
        r = 0.2 - 0.06 * t;
        g = 0.2 - 0.07 * t;
        b = 0.21 - 0.09 * t;
      }
      for (const p of PANELS) {
        const w = inPanel(az, el, p) * p.power;
        r += w;
        g += w * 0.98;
        b += w * 0.95;
      }
      const k = (j * W + i) * 4;
      data[k] = DataUtils.toHalfFloat(r);
      data[k + 1] = DataUtils.toHalfFloat(g);
      data[k + 2] = DataUtils.toHalfFloat(b);
      data[k + 3] = DataUtils.toHalfFloat(1);
    }
  }
  const tex = own(new DataTexture(data, W, H, RGBAFormat, HalfFloatType));
  tex.mapping = EquirectangularReflectionMapping;
  tex.colorSpace = LinearSRGBColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  studio = tex;
  return tex;
}
