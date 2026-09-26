/**
 * The CSS blend modes pokemon-cards-css and pokemon-cards-151 composite their
 * foil layers with, all sixteen of CSS's, as GLSL and as TypeScript, and CSS's
 * compositing of one straight-alpha colour over another (compositeRGBA and
 * compositeOver), which the RGBA path (shader/compile.ts) is built on.
 *
 * Both sides implement the W3C compositing formulas exactly. The TypeScript
 * twins are not used at runtime — they exist so the formulas can be tested
 * against known values, because a wrong soft-light is invisible in a
 * screenshot and obvious in an assertion.
 *
 * `plus-lighter` is strictly a compositing operator in CSS, not a blend: a
 * semi-transparent source is scaled by its alpha *before* the add, where here
 * element opacity lerps toward the clamped sum afterwards. The two agree until
 * the sum saturates.
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
  | 'luminosity'
  | 'plus-lighter'
  | 'color-burn'
  | 'color';

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
  'plus-lighter': 14,
  'color-burn': 15,
  // appended, so no older blend's id moves (effects/unchanged.test.ts)
  color: 16,
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
    case 'plus-lighter':
      return perChannel(backdrop, source, (b, s) => Math.min(1, b + s));
    case 'color-burn':
      return perChannel(backdrop, source, (b, s) =>
        b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s),
      );
    case 'color':
      return setLum(source, lum(backdrop)).map(clamp01) as Out;
  }
}

export type RGBA = readonly [number, number, number, number];

/**
 * CSS compositing, W3C Compositing and Blending Level 1: `source` over
 * `backdrop`, both straight (unpremultiplied) colour and alpha, the blend
 * applied only where both are present. The RGBA path (shader/compile.ts)
 * composites each layer onto the layers beneath it, each child onto its
 * group and each group onto the card this way; compositeOver below is its
 * GLSL.
 */
export function compositeRGBA(
  mode: BlendMode,
  backdrop: RGBA,
  source: RGBA,
): [number, number, number, number] {
  const [bA, sA] = [backdrop[3], source[3]];
  const blended = blendRGB(mode, backdrop.slice(0, 3), source.slice(0, 3));
  const a = sA + bA * (1 - sA);
  const channel = (i: number) =>
    a > 0
      ? (sA * (1 - bA) * source[i] + sA * bA * blended[i] + (1 - sA) * bA * backdrop[i]) / a
      : 0;
  return [channel(0), channel(1), channel(2), a];
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

vec3 blendPlusLighter(vec3 b, vec3 s) { return min(b + s, vec3(1.0)); }

// W3C: b == 1 gives 1, else s == 0 gives 0, else 1 - min(1, (1 - b) / s). The
// max() only keeps the division finite (0 / 0 is NaN, and NaN survives mix());
// the two step() lines then apply the two special cases, white backdrop last
// because it wins.
vec3 blendColorBurn(vec3 b, vec3 s) {
  vec3 r = 1.0 - min(vec3(1.0), (1.0 - b) / max(s, 1e-6));
  r = mix(r, vec3(0.0), step(s, vec3(0.0)));
  return mix(r, vec3(1.0), step(1.0, b));
}

vec3 blendColor(vec3 b, vec3 s) { return bSetLum(s, bLum(b)); }

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
    case ${BLEND_ID['plus-lighter']}: return blendPlusLighter(b, s);
    case ${BLEND_ID['color-burn']}: return blendColorBurn(b, s);
    case ${BLEND_ID.color}: return blendColor(b, s);
    case ${BLEND_ID.normal}: return s;
  }
  return s;
}

// CSS compositing (compositeRGBA's twin), straight colour: the source's alpha
// over the backdrop's, and each channel a mix of the source, the blend of the
// two and the backdrop, weighted by which of them covers the fragment.
float compositeAlpha(float bA, float sA) {
  return sA + bA * (1.0 - sA);
}

float compositeChannel(float cb, float bA, float cs, float sA, float blended) {
  float a = compositeAlpha(bA, sA);
  return a > 0.0 ? (sA * (1.0 - bA) * cs + sA * bA * blended + (1.0 - sA) * bA * cb) / a : 0.0;
}

vec4 compositeOver(vec4 b, vec4 s, int mode) {
  vec3 blended = blendWith(mode, b.rgb, s.rgb);
  return vec4(
    compositeChannel(b.r, b.a, s.r, s.a, blended.r),
    compositeChannel(b.g, b.a, s.g, s.a, blended.g),
    compositeChannel(b.b, b.a, s.b, s.a, blended.b),
    compositeAlpha(b.a, s.a)
  );
}
`;
