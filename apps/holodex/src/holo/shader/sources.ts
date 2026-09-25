import type { Source } from './types';

export const SOURCE_ID: Record<Source['kind'], number> = {
  solid: 0,
  'repeating-linear': 1,
  linear: 2,
  'radial-pointer': 3,
  conic: 4,
  glitter: 5,
  grain: 6,
  card: 7,
  scanlines: 8,
  iri: 9,
  birthday: 10,
  pokeball: 11,
  'pokeball-inner': 12,
  masterball: 13,
  'masterball-inner': 14,
  'css-linear': 15,
  'css-radial': 16,
  'css-conic': 17,
  geometric: 18,
  trainerbg: 19,
  illusion: 20,
  'illusion-mask': 21,
};

/**
 * background-size then background-position, in that order — the same order
 * CSS applies them. The GLSL twin below must stay identical; the test pins it.
 */
export function uvTransform(
  uv: readonly [number, number],
  size: readonly [number, number],
  offset: readonly [number, number],
): [number, number] {
  return [uv[0] * size[0] + offset[0], uv[1] * size[1] + offset[1]];
}

/**
 * The card's height over its width, 88 over 63: what a CSS radial's circle is
 * round in, where the shader's uv runs 0..1 along each side regardless.
 */
export const CARD_HEIGHT_OVER_WIDTH = 88 / 63;

/**
 * The layer-source samplers. Gradient stops arrive as a uniform array so one
 * compiled program can serve every effect that uses the same source kinds;
 * only the data differs.
 */
export const sourcesGLSL = /* glsl */ `
#define MAX_STOPS 8
#define MAX_CSS_STOPS 32

const float CARD_HEIGHT_OVER_WIDTH = ${CARD_HEIGHT_OVER_WIDTH.toFixed(6)};

uniform sampler2D uCard;
uniform sampler2D uGlitter;
uniform sampler2D uGrain;
uniform sampler2D uIri;
uniform sampler2D uBirthday;
uniform sampler2D uPokeball;
uniform sampler2D uPokeballInner;
uniform sampler2D uMasterball;
uniform sampler2D uMasterballInner;
uniform sampler2D uGeometric;
uniform sampler2D uTrainerbg;
uniform sampler2D uIllusion;
uniform sampler2D uIllusionMask;
uniform vec2 uPointer;        // -1..1 across the card
uniform vec2 uPointerUV;      // 0..1, for radial gradients centred on it
uniform float uPointerFromCenter;
uniform float uTime;
uniform vec3 uCardGlow;     // the card's --card-glow, for stops that are part glow
uniform float uFoilBrightness; // the card's --foil-brightness, for reverse-holo's shine

vec2 uvTransform(vec2 uv, vec2 size, vec2 offset) {
  return uv * size + offset;
}

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

/** brightness, contrast and saturate, matching CSS's filter functions. */
vec3 applyFilter(vec3 c, float brightness, float contrast, float saturate) {
  c *= brightness;
  c = (c - 0.5) * contrast + 0.5;
  c = mix(vec3(luma(c)), c, saturate);
  return clamp(c, 0.0, 1.0);
}

/**
 * CSS's brightness(), contrast() and saturate() as Chrome applies them to an
 * element, measured headless (effects/css.test.ts holds the twin to Chrome's
 * own readings): each function clamped before the next, and saturate about
 * CSS's own luma (0.213, 0.715, 0.072), where applyFilter above clamps once
 * and saturates about Rec. 601's — off by up to 55 in 0..255 under a strong
 * contrast. The RGBA path's filter; css.ts#cssFilterRGB is its twin.
 */
vec3 applyCssFilter(vec3 c, float brightness, float contrast, float saturate) {
  c = clamp(c * brightness, 0.0, 1.0);
  c = clamp((c - 0.5) * contrast + 0.5, 0.0, 1.0);
  float l = dot(c, vec3(0.213, 0.715, 0.072));
  return clamp(mix(vec3(l), c, saturate), 0.0, 1.0);
}

vec3 gradientAt(vec3 stops[MAX_STOPS], int count, float t) {
  t = fract(t);
  float scaled = t * float(count);
  int i = int(floor(scaled));
  int j = i + 1 >= count ? 0 : i + 1;
  return mix(stops[i], stops[j], fract(scaled));
}

vec3 srcSolid(vec3 color) { return color; }

vec3 srcRepeatingLinear(vec2 uv, float angleDeg, float space, vec3 stops[MAX_STOPS], int count) {
  float a = radians(angleDeg);
  float t = (uv.x * cos(a) + uv.y * sin(a)) / max(space, 1e-4);
  return gradientAt(stops, count, t);
}

vec3 srcLinear(vec2 uv, float angleDeg, vec3 stops[MAX_STOPS], int count) {
  float a = radians(angleDeg);
  float t = clamp(uv.x * cos(a) + uv.y * sin(a), 0.0, 1.0);
  return gradientAt(stops, count, t * (1.0 - 1.0 / float(count)));
}

/**
 * How far out along a CSS radial-gradient a fragment is, in radii, unclamped:
 * CSS carries a stop past 100% beyond the ending shape. centre is on the
 * card, size its image's, at the centre's fraction of that image, which CSS
 * measures the farthest corner from, all as fractions of the card. A circle
 * reaches the farthest corner; an ellipse (ellipse 1) keeps farthest-side's
 * aspect and grows by √2 to pass through it. Lengths are in card widths, so
 * the circle is round on the card. Written out in scalars so the test can
 * run it; css.ts#reach is its twin.
 */
float radialReach(vec2 uv, vec2 centre, vec2 size, vec2 at, float ellipse) {
  float sideX = size.x * max(at.x, 1.0 - at.x);
  float sideY = size.y * max(at.y, 1.0 - at.y) * CARD_HEIGHT_OVER_WIDTH;
  float dx = uv.x - centre.x;
  float dy = (uv.y - centre.y) * CARD_HEIGHT_OVER_WIDTH;
  float circle = sqrt(dx * dx + dy * dy) / sqrt(sideX * sideX + sideY * sideY);
  float oval = sqrt((dx / sideX) * (dx / sideX) + (dy / sideY) * (dy / sideY)) / 1.4142136;
  return mix(circle, oval, ellipse);
}

/**
 * How far along a CSS radial-gradient(farthest-corner circle at the pointer) a
 * fragment is, 0 at the centre and 1 at the radius: the radial css.ts
 * converts for the older kinds (Source's cssBox), whose centre sits at the
 * pointer's fraction of its image. css.ts#radialT is its twin.
 */
float radialCssDistance(vec2 uv, vec2 centre, vec2 size) {
  return clamp(radialReach(uv, centre, size, uPointerUV, 0.0), 0.0, 1.0);
}

vec3 srcRadialCss(vec2 uv, vec2 centre, vec2 size, vec3 stops[MAX_STOPS], int count) {
  float d = radialCssDistance(uv, centre, size);
  return gradientAt(stops, count, d * (1.0 - 1.0 / float(count)));
}

vec3 srcRadialPointer(vec2 uv, vec3 stops[MAX_STOPS], int count) {
  float d = clamp(length(uv - uPointerUV) * 1.4142, 0.0, 1.0);
  return gradientAt(stops, count, d * (1.0 - 1.0 / float(count)));
}

vec3 srcConic(vec2 uv, vec3 stops[MAX_STOPS], int count) {
  vec2 d = uv - 0.5;
  float t = (atan(d.y, d.x) + 3.14159265) / 6.2831853;
  return gradientAt(stops, count, t);
}

/**
 * Where a fragment falls around a CSS conic-gradient, in turns clockwise from
 * from (itself in turns from the top), about centre, measured in the card's
 * true proportions as CSS measures a conic's angle. css.ts#turn is its twin.
 */
float conicTurn(vec2 uv, vec2 centre, float from) {
  float dx = uv.x - centre.x;
  float dy = (uv.y - centre.y) * CARD_HEIGHT_OVER_WIDTH;
  return fract(atan(dx, -dy) / 6.2831853 - from);
}

/**
 * t's place among an exact gradient's stops, in stop indices: 0 at or before
 * the first, count - 1 at or after the last, fractional between two, and past
 * a hard edge (two stops at one place) at once. css.ts#cssStopIndex is its
 * twin.
 */
float cssStopIndex(float pos[MAX_CSS_STOPS], int count, float t) {
  float index = 0.0;
  for (int i = 1; i < MAX_CSS_STOPS; i += 1) {
    if (i >= count || t <= pos[i - 1]) break;
    float span = pos[i] - pos[i - 1];
    index = t >= pos[i] ? float(i) : float(i - 1) + (t - pos[i - 1]) / span;
  }
  return index;
}

/**
 * An exact gradient's colour at t: its stops premultiplied, as CSS
 * interpolates them, looked up where CSS puts them, and handed back as
 * straight colour and alpha.
 */
vec4 cssStops(vec4 stops[MAX_CSS_STOPS], float pos[MAX_CSS_STOPS], int count, float t) {
  float index = cssStopIndex(pos, count, t);
  int i = int(floor(index));
  int j = min(i + 1, count - 1);
  vec4 c = mix(stops[i], stops[j], index - float(i));
  return vec4(c.a > 0.0 ? c.rgb / c.a : vec3(0.0), c.a);
}

vec3 srcGlitter(vec2 uv, float scale) { return texture(uGlitter, uv * scale).rgb; }
vec3 srcGrain(vec2 uv, float scale) { return texture(uGrain, uv * scale).rgb; }
vec3 srcIri(vec2 uv, float scale) { return texture(uIri, uv * scale).rgb; }
vec3 srcBirthday(vec2 uv, float scale) { return texture(uBirthday, uv * scale).rgb; }
vec3 srcPokeball(vec2 uv, float scale) { return texture(uPokeball, uv * scale).rgb; }
vec3 srcPokeballInner(vec2 uv, float scale) { return texture(uPokeballInner, uv * scale).rgb; }
vec3 srcMasterball(vec2 uv, float scale) { return texture(uMasterball, uv * scale).rgb; }
vec3 srcMasterballInner(vec2 uv, float scale) { return texture(uMasterballInner, uv * scale).rgb; }
vec3 srcGeometric(vec2 uv, float scale) { return texture(uGeometric, uv * scale).rgb; }
vec3 srcTrainerbg(vec2 uv, float scale) { return texture(uTrainerbg, uv * scale).rgb; }
vec3 srcIllusion(vec2 uv, float scale) { return texture(uIllusion, uv * scale).rgb; }
vec3 srcIllusionMask(vec2 uv, float scale) { return texture(uIllusionMask, uv * scale).rgb; }
// a texture sampled with its alpha, on the RGBA path
vec4 srcIllusionMask4(vec2 uv, float scale) { return texture(uIllusionMask, uv * scale); }
vec3 srcCard(vec2 uv) { return texture(uCard, uv).rgb; }

vec3 srcScanlines(vec2 uv, float spacing, float light, float dark) {
  float s = step(0.5, fract(uv.y / max(spacing, 1e-4)));
  return vec3(mix(dark, light, s));
}
`;
