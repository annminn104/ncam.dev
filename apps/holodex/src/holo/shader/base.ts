import { SHAPE_ID } from '../regions';

export const VERTEX_SHADER = /* glsl */ `
out vec2 vUv;
void main() {
  // three.js's PlaneGeometry emits uv.y = 1 at the top (uv.y points up —
  // PlaneGeometry.js pushes 1 - (iy / gridY)), but everything downstream of
  // vUv is authored in y-down card space: the clip insets and stage cut-out
  // in regions.ts, every effect's fromTop offset, and the CSS-derived
  // gradients they all come from. Flip once here so vUv matches that
  // convention everywhere else it's consumed, instead of leaving every
  // consumer to re-derive (or silently disagree about) the flip.
  vUv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Everything every effect shares: the varyings, the clip uniforms, and the
 * coverage function. The coverage maths mirrors `coversPoint` in ../regions.ts
 * exactly — that function is its tested twin.
 */
export const baseGLSL = /* glsl */ `
in vec2 vUv;
out vec4 fragColor;

uniform vec4 uClipRect;   // top, right, bottom, left, as fractions
uniform int uClipShape;
uniform float uInvert;    // 1.0 for reverse holo
uniform float uCardOpacity;

const float STAGE_STEP_X = 0.57;
const float STAGE_STEP_Y = 0.16;

/**
 * Whether the foil reaches this fragment. uv.y runs down the card — true
 * because the vertex shader above flips three.js's y-up uv before vUv ever
 * reaches here.
 */
float coverage(vec2 uv) {
  float inside = step(uClipRect.w, uv.x)
               * step(uv.x, 1.0 - uClipRect.y)
               * step(uClipRect.x, uv.y)
               * step(uv.y, 1.0 - uClipRect.z);

  if (uClipShape == ${SHAPE_ID.stage}) {
    float inStep = step(uv.x, STAGE_STEP_X) * step(uv.y, STAGE_STEP_Y);
    inside *= 1.0 - inStep;
  }

  return mix(inside, 1.0 - inside, uInvert);
}
`;
