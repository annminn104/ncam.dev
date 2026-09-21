/**
 * The CSS blend modes pokemon-cards-css composites its foil layers with,
 * as GLSL and as TypeScript.
 *
 * Both sides implement the W3C compositing formulas exactly. The TypeScript
 * twins are not used at runtime — they exist so the formulas can be tested
 * against known values, because a wrong soft-light is invisible in a
 * screenshot and obvious in an assertion.
 */

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'luminosity';

export const BLEND_ID: Record<BlendMode, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  darken: 4,
  lighten: 5,
  'color-dodge': 6,
  'hard-light': 7,
  'soft-light': 8,
  difference: 9,
  exclusion: 10,
  hue: 11,
  saturation: 12,
  luminosity: 13,
};

// ---------------------------------------------------------------- TypeScript

type RGB = readonly [number, number, number] | readonly number[];
type Out = [number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const perChannel = (b: RGB, s: RGB, f: (b: number, s: number) => number): Out => [
  clamp01(f(b[0], s[0])),
  clamp01(f(b[1], s[1])),
  clamp01(f(b[2], s[2])),
];

const lum = (c: RGB) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

function clipColor(c: Out): Out {
  const l = lum(c);
  const n = Math.min(c[0], c[1], c[2]);
  const x = Math.max(c[0], c[1], c[2]);
  let out: Out = [c[0], c[1], c[2]];
  if (n < 0) out = out.map((v) => l + ((v - l) * l) / (l - n || 1e-6)) as Out;
  if (x > 1) out = out.map((v) => l + ((v - l) * (1 - l)) / (x - l || 1e-6)) as Out;
  return out;
}

function setLum(c: RGB, l: number): Out {
  const d = l - lum(c);
  return clipColor([c[0] + d, c[1] + d, c[2] + d]);
}

const sat = (c: RGB) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);

function setSat(c: RGB, s: number): Out {
  const out: Out = [c[0], c[1], c[2]];
  const mx = Math.max(out[0], out[1], out[2]);
  const mn = Math.min(out[0], out[1], out[2]);
  if (mx <= mn) return [0, 0, 0];
  return out.map((v) => ((v - mn) / (mx - mn)) * s) as Out;
}

const softLightChannel = (b: number, s: number): number => {
  if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
  const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
  return b + (2 * s - 1) * (d - b);
};

/** Blend `source` onto `backdrop`, both non-premultiplied RGB in 0..1. */
export function blendRGB(mode: BlendMode, backdrop: RGB, source: RGB): Out {
  switch (mode) {
    case 'normal':
      return [clamp01(source[0]), clamp01(source[1]), clamp01(source[2])];
    case 'multiply':
      return perChannel(backdrop, source, (b, s) => b * s);
    case 'screen':
      return perChannel(backdrop, source, (b, s) => b + s - b * s);
    case 'overlay':
      return perChannel(backdrop, source, (b, s) =>
        b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s),
      );
    case 'darken':
      return perChannel(backdrop, source, (b, s) => Math.min(b, s));
    case 'lighten':
      return perChannel(backdrop, source, (b, s) => Math.max(b, s));
    case 'color-dodge':
      return perChannel(backdrop, source, (b, s) =>
        b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s)),
      );
    case 'hard-light':
      return perChannel(backdrop, source, (b, s) =>
        s <= 0.5 ? 2 * s * b : 1 - 2 * (1 - s) * (1 - b),
      );
    case 'soft-light':
      return perChannel(backdrop, source, softLightChannel);
    case 'difference':
      return perChannel(backdrop, source, (b, s) => Math.abs(b - s));
    case 'exclusion':
      return perChannel(backdrop, source, (b, s) => b + s - 2 * b * s);
    case 'hue':
      return setLum(setSat(source, sat(backdrop)), lum(backdrop)).map(clamp01) as Out;
    case 'saturation':
      return setLum(setSat(backdrop, sat(source)), lum(backdrop)).map(clamp01) as Out;
    case 'luminosity':
      return setLum(backdrop, lum(source)).map(clamp01) as Out;
  }
}

// ---------------------------------------------------------------------- GLSL

/**
 * Appended verbatim into every generated fragment shader. `blendWith`
 * dispatches on the same integers as BLEND_ID, so the two implementations
 * cannot drift apart without a test noticing.
 */
export const blendGLSL = /* glsl */ `
float bLum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }

vec3 bClipColor(vec3 c) {
  float l = bLum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + ((c - l) * l) / max(l - n, 1e-6);
  if (x > 1.0) c = l + ((c - l) * (1.0 - l)) / max(x - l, 1e-6);
  return c;
}

vec3 bSetLum(vec3 c, float l) { return bClipColor(c + (l - bLum(c))); }

float bSat(vec3 c) {
  return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
}

vec3 bSetSat(vec3 c, float s) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  if (mx <= mn) return vec3(0.0);
  return ((c - mn) / (mx - mn)) * s;
}

vec3 blendMultiply(vec3 b, vec3 s) { return b * s; }
vec3 blendScreen(vec3 b, vec3 s) { return b + s - b * s; }
vec3 blendDarken(vec3 b, vec3 s) { return min(b, s); }
vec3 blendLighten(vec3 b, vec3 s) { return max(b, s); }
vec3 blendDifference(vec3 b, vec3 s) { return abs(b - s); }
vec3 blendExclusion(vec3 b, vec3 s) { return b + s - 2.0 * b * s; }

vec3 blendOverlay(vec3 b, vec3 s) {
  return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b));
}

vec3 blendHardLight(vec3 b, vec3 s) {
  return mix(2.0 * s * b, 1.0 - 2.0 * (1.0 - s) * (1.0 - b), step(0.5, s));
}

vec3 blendColorDodge(vec3 b, vec3 s) {
  vec3 r = min(vec3(1.0), b / max(1.0 - s, 1e-6));
  r = mix(r, vec3(1.0), step(1.0, s));
  return mix(r, vec3(0.0), step(b, vec3(0.0)));
}

vec3 blendSoftLight(vec3 b, vec3 s) {
  vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, step(b, vec3(0.25)));
  vec3 lo = b - (1.0 - 2.0 * s) * b * (1.0 - b);
  vec3 hi = b + (2.0 * s - 1.0) * (d - b);
  return mix(lo, hi, step(0.5, s));
}

vec3 blendHue(vec3 b, vec3 s) { return bSetLum(bSetSat(s, bSat(b)), bLum(b)); }
vec3 blendSaturation(vec3 b, vec3 s) { return bSetLum(bSetSat(b, bSat(s)), bLum(b)); }
vec3 blendLuminosity(vec3 b, vec3 s) { return bSetLum(b, bLum(s)); }

vec3 blendWith(int mode, vec3 b, vec3 s) {
  switch (mode) {
    case ${BLEND_ID.multiply}: return blendMultiply(b, s);
    case ${BLEND_ID.screen}: return blendScreen(b, s);
    case ${BLEND_ID.overlay}: return blendOverlay(b, s);
    case ${BLEND_ID.darken}: return blendDarken(b, s);
    case ${BLEND_ID.lighten}: return blendLighten(b, s);
    case ${BLEND_ID['color-dodge']}: return blendColorDodge(b, s);
    case ${BLEND_ID['hard-light']}: return blendHardLight(b, s);
    case ${BLEND_ID['soft-light']}: return blendSoftLight(b, s);
    case ${BLEND_ID.difference}: return blendDifference(b, s);
    case ${BLEND_ID.exclusion}: return blendExclusion(b, s);
    case ${BLEND_ID.hue}: return blendHue(b, s);
    case ${BLEND_ID.saturation}: return blendSaturation(b, s);
    case ${BLEND_ID.luminosity}: return blendLuminosity(b, s);
    case ${BLEND_ID.normal}: return s;
  }
  return s;
}
`;
