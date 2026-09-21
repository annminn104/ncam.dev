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
 * The layer-source samplers. Gradient stops arrive as a uniform array so one
 * compiled program can serve every effect that uses the same source kinds;
 * only the data differs.
 */
export const sourcesGLSL = /* glsl */ `
#define MAX_STOPS 8

uniform sampler2D uCard;
uniform sampler2D uGlitter;
uniform sampler2D uGrain;
uniform vec2 uPointer;        // -1..1 across the card
uniform vec2 uPointerUV;      // 0..1, for radial gradients centred on it
uniform float uPointerFromCenter;
uniform float uTime;

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

vec3 srcRadialPointer(vec2 uv, vec3 stops[MAX_STOPS], int count) {
  float d = clamp(length(uv - uPointerUV) * 1.4142, 0.0, 1.0);
  return gradientAt(stops, count, d * (1.0 - 1.0 / float(count)));
}

vec3 srcConic(vec2 uv, vec3 stops[MAX_STOPS], int count) {
  vec2 d = uv - 0.5;
  float t = (atan(d.y, d.x) + 3.14159265) / 6.2831853;
  return gradientAt(stops, count, t);
}

vec3 srcGlitter(vec2 uv, float scale) { return texture(uGlitter, uv * scale).rgb; }
vec3 srcGrain(vec2 uv, float scale) { return texture(uGrain, uv * scale).rgb; }
vec3 srcCard(vec2 uv) { return texture(uCard, uv).rgb; }

vec3 srcScanlines(vec2 uv, float spacing, float light, float dark) {
  float s = step(0.5, fract(uv.y / max(spacing, 1e-4)));
  return vec3(mix(dark, light, s));
}
`;
