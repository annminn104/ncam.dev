import {
  BackSide,
  Color,
  DataTexture,
  LinearFilter,
  MeshBasicMaterial,
  MeshToonMaterial,
  RGBAFormat,
} from 'three';
import type { Side } from '../../../../game/coords';
import { onDispose, own } from '../../dispose';
import { FIGURE_METALS, FIGURE_PALETTES, type FigurePresetId, type Metal } from './palettes';
import { SLOT_GEM, SLOT_GLOW, SLOT_GOLD, SLOTS } from './slots';

// The approved Blender look (art/blender/kit.py's M_Paint and M_Line), in three. Paint: a soft
// two-tone grey toon ramp (three's toon lighting reads only its red channel, so the shadow is
// neutral, as in the approved in-game test) with a rim on the lit side, gold or silver from a
// metal ramp by view angle, faceted gems with a glint, unlit glow. Outline: an inverted hull drawn
// from the same geometry, each part's ink its own colour darkened. Colours come from a palette
// uniform indexed by each vertex's slot, so both sides draw the same geometry.

/**
 * The floor under the light level that lights the albedo: low enough to keep the toon shadow,
 * high enough that the white side stays white under Blood Moon's red key.
 */
export const L_MIN = 0.55;

/** kit.py's GOLD_STOPS and SILVER_STOPS: dark at grazing angles, white in the highlight. */
export const METAL_RAMPS: Record<Metal, readonly (readonly [at: number, hex: string])[]> = {
  gold: [
    [0, '#3a1f08'],
    [0.38, '#74410f'],
    [0.6, '#b9761d'],
    [0.8, '#e9a932'],
    [0.885, '#f6c24a'],
    [0.94, '#ffe08a'],
    [0.972, '#fff4cf'],
    [0.99, '#ffffff'],
  ],
  silver: [
    [0, '#1b1e26'],
    [0.38, '#3b404c'],
    [0.6, '#69707f'],
    [0.8, '#a0a8b7'],
    [0.885, '#c0c6d2'],
    [0.94, '#dbe0e8'],
    [0.972, '#eef1f5'],
    [0.99, '#ffffff'],
  ],
};
/** Every ramp has as many stops: the shader's arrays are sized by it, one program for all. */
const STOPS = METAL_RAMPS.gold.length;

/** Inserts `code` before or after `anchor` in a three shader; throws if three no longer has it. */
export function inject(
  source: string,
  anchor: string,
  code: string,
  where: 'before' | 'after',
): string {
  if (!source.includes(anchor)) throw new Error(`figure shader: three has no ${anchor}`);
  return source.replace(anchor, where === 'before' ? `${code}\n${anchor}` : `${anchor}\n${code}`);
}

const glsl = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));

const PAINT_VERTEX_HEAD = `attribute float _slot;
uniform vec3 figurePalette[${SLOTS.length}];
varying vec3 vAlbedo;
varying float vSlot;`;
const PAINT_VERTEX_BODY = `vSlot = _slot;
vAlbedo = figurePalette[int(_slot + 0.5)];`;
const PAINT_FRAGMENT_HEAD = `varying vec3 vAlbedo;
varying float vSlot;
uniform vec3 figureMetal[${STOPS}];
uniform float figureMetalAt[${STOPS}];
vec3 figureMetalRamp(float t) {
  vec3 c = figureMetal[0];
  for (int i = 1; i < ${STOPS}; i++) {
    float k = clamp((t - figureMetalAt[i - 1]) / max(figureMetalAt[i] - figureMetalAt[i - 1], 1e-4), 0.0, 1.0);
    if (t > figureMetalAt[i - 1]) c = mix(figureMetal[i - 1], figureMetal[i], k);
  }
  return c;
}`;
// After three's lighting: outgoingLight is lit, diffuseColor the albedo, normal in view space
// (+z toward the camera; Blender's camera space has it the other way round).
const PAINT_SHADING = `{
  vec3 n = normalize(normal);
  float f = dot(n, normalize(vec3(-0.35, 0.62, 0.70)));
  float lit = dot(outgoingLight, vec3(0.299, 0.587, 0.114)) /
    max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 1e-3);
  if (abs(vSlot - ${glsl(SLOT_GOLD)}) < 0.5) {
    outgoingLight = figureMetalRamp(f * 0.5 + 0.5) * clamp(0.55 + 0.6 * lit, 0.0, 1.05);
  } else if (abs(vSlot - ${glsl(SLOT_GEM)}) < 0.5) {
    outgoingLight = f > 0.9 ? vec3(1.0)
      : mix(diffuseColor.rgb * 0.22, diffuseColor.rgb * 1.7, clamp((f + 0.5) / 1.38, 0.0, 1.0));
  } else if (abs(vSlot - ${glsl(SLOT_GLOW)}) < 0.5) {
    outgoingLight = diffuseColor.rgb * 1.4;
  } else {
    // An arena's light keeps a quarter of its tint: Blood Moon's red would turn a robe orange.
    outgoingLight = mix(diffuseColor.rgb * max(lit, ${glsl(L_MIN)}), outgoingLight, 0.25);
    outgoingLight += smoothstep(0.6, 0.8, 1.0 - max(n.z, 0.0)) * step(0.5, lit) * 0.25 * diffuseColor.rgb;
  }
}`;

const OUTLINE_VERTEX_HEAD = `attribute float _slot;
attribute float _line;
attribute vec3 outlineNormal;
uniform vec3 figurePalette[${SLOTS.length}];
varying vec3 vInk;`;
const OUTLINE_VERTEX_BODY = `transformed += outlineNormal * _line;
vInk = figurePalette[int(_slot + 0.5)] * vec3(0.085, 0.066, 0.08) + vec3(0.006, 0.005, 0.009);`;
// Decals and painted lines draw no hull: outside the clip volume, their triangles vanish.
const OUTLINE_CLIP = 'if (_line <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);';

let ramp: DataTexture | null = null;

/**
 * The soft two-tone ramp: a grey shadow (0.42), a smooth step from 0.44 to 0.54, then full light.
 * three's toon lighting samples only the red channel (gradientmap_pars_fragment), so the shadow is
 * neutral, as in the approved in-game test. R, G and B carry the same value: nothing else is read.
 */
function toonRamp(): DataTexture {
  if (ramp) return ramp;
  const size = 32;
  const shadow = 0.42;
  const data = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const k = Math.min(1, Math.max(0, (i / (size - 1) - 0.44) / 0.1));
    const s = k * k * (3 - 2 * k);
    const grey = Math.round(255 * (shadow + (1 - shadow) * s));
    data.set([grey, grey, grey, 255], i * 4);
  }
  const texture = new DataTexture(data, size, 1, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  ramp = own(texture);
  return ramp;
}

/** A side's palette as linear colours (three converts the sRGB hex). */
function colours(preset: FigurePresetId, side: Side): Color[] {
  return FIGURE_PALETTES[preset][side].map((hex) => new Color(hex));
}

function createPaint(palette: Color[], metal: Metal): MeshToonMaterial {
  const material = new MeshToonMaterial({ gradientMap: toonRamp() });
  const ramp = METAL_RAMPS[metal];
  const colors = ramp.map(([, hex]) => new Color(hex));
  const stops = ramp.map(([at]) => at);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.figurePalette = { value: palette };
    shader.uniforms.figureMetal = { value: colors };
    shader.uniforms.figureMetalAt = { value: stops };
    let vertex = inject(shader.vertexShader, 'void main() {', PAINT_VERTEX_HEAD, 'before');
    vertex = inject(vertex, '#include <begin_vertex>', PAINT_VERTEX_BODY, 'after');
    let fragment = inject(shader.fragmentShader, 'void main() {', PAINT_FRAGMENT_HEAD, 'before');
    fragment = inject(
      fragment,
      '#include <color_fragment>',
      'diffuseColor.rgb = vAlbedo;',
      'after',
    );
    fragment = inject(fragment, '#include <opaque_fragment>', PAINT_SHADING, 'before');
    shader.vertexShader = vertex;
    shader.fragmentShader = fragment;
  };
  return material;
}

function createOutline(palette: Color[]): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ side: BackSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.figurePalette = { value: palette };
    let vertex = inject(shader.vertexShader, 'void main() {', OUTLINE_VERTEX_HEAD, 'before');
    vertex = inject(vertex, '#include <begin_vertex>', OUTLINE_VERTEX_BODY, 'after');
    vertex = inject(vertex, '#include <project_vertex>', OUTLINE_CLIP, 'after');
    let fragment = inject(shader.fragmentShader, 'void main() {', 'varying vec3 vInk;', 'before');
    fragment = inject(fragment, '#include <color_fragment>', 'diffuseColor.rgb = vInk;', 'after');
    shader.vertexShader = vertex;
    shader.fragmentShader = fragment;
  };
  return material;
}

// One of each per preset and side. Every paint (and every outline) shares one compiled program:
// three keys programs by the hook's source, and the palette is a uniform.
const paints = new Map<string, MeshToonMaterial>();
const outlines = new Map<string, MeshBasicMaterial>();
onDispose(() => {
  paints.clear();
  outlines.clear();
  ramp = null;
});

/** The paint of a figure preset's side: cached, and owned by the battle (dispose.ts). */
export function paintMaterial(preset: FigurePresetId, side: Side): MeshToonMaterial {
  const key = `${preset}:${side}`;
  let material = paints.get(key);
  if (!material) {
    material = own(createPaint(colours(preset, side), FIGURE_METALS[preset][side]));
    paints.set(key, material);
  }
  return material;
}

/** The ink outline of a figure preset's side: cached, and owned by the battle (dispose.ts). */
export function outlineMaterial(preset: FigurePresetId, side: Side): MeshBasicMaterial {
  const key = `${preset}:${side}`;
  let material = outlines.get(key);
  if (!material) {
    material = own(createOutline(colours(preset, side)));
    outlines.set(key, material);
  }
  return material;
}
