import { SHAPE_ID } from '../regions';

export const VERTEX_SHADER = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
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

/** Whether the foil reaches this fragment. uv.y runs down the card. */
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
