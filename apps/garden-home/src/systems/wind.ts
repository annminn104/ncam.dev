import type { Material } from 'three';
import { globalUniforms } from './uniforms';

// Meshopt quantization (pipeline/src/optimize.mjs) stores `position` in [-1, 1] and moves the real size onto the node
// matrix, so phase and amplitude must not be measured in local units: the phase comes from the world
// position, and the displacement is a metre amount divided by the node scale (uniform scale assumed).
const WIND_GLSL = /* glsl */ `
  vec3 windWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  float windPhase = dot(windWorld, vec3(0.9, 0.0, 0.7));
  float windMetres = windWeight * uWind / length(modelMatrix[0].xyz);
  float windSway = sin(uTime * 1.6 + windPhase) * 0.6 + sin(uTime * 2.9 + windPhase * 1.7) * 0.4;
  transformed.x += windSway * 0.08 * windMetres;
  transformed.z += cos(uTime * 1.3 + windPhase) * 0.05 * windMetres;
`;

export function patchWindVertex(source: string): string {
  if (!source.includes('#include <common>') || !source.includes('#include <begin_vertex>')) {
    throw new Error('wind: expected <common> and <begin_vertex> chunks');
  }
  return source
    .replace(
      '#include <common>',
      '#include <common>\nattribute float windWeight;\nuniform float uTime;\nuniform float uWind;',
    )
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WIND_GLSL}`);
}

/**
 * Makes vertices sway by their windWeight. Idempotent.
 * Only call for materials whose meshes all carry windWeight: GLTFLoader already gives
 * vertex-colored meshes their own material variant, so this holds for module GLBs.
 */
export function applyWind(material: Material): void {
  if (material.userData.windPatched) return;
  material.userData.windPatched = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = globalUniforms.uTime;
    shader.uniforms.uWind = globalUniforms.uWind;
    shader.vertexShader = patchWindVertex(shader.vertexShader);
  };
  material.customProgramCacheKey = () => 'wind';
  material.needsUpdate = true;
}
