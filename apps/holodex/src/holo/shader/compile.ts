import { BLEND_ID, blendGLSL } from './blend';
import { sourcesGLSL } from './sources';
import { baseGLSL, VERTEX_SHADER } from './base';
import type { Effect, Element, Filter, Layer, PointerDriven, Source } from './types';

export { VERTEX_SHADER };

const f = (n: number): string => n.toFixed(6);
const vec3 = (c: readonly number[]): string => `vec3(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;

/** A pointer-driven number becomes a GLSL expression, not a constant. */
function driven(p: PointerDriven | undefined, fallback: number): string {
  if (!p) return f(fallback);
  const terms = [f(p.base)];
  if (p.fromCenter) terms.push(`${f(p.fromCenter)} * uPointerFromCenter`);
  if (p.fromLeft) terms.push(`${f(p.fromLeft)} * (uPointerUV.x)`);
  if (p.fromTop) terms.push(`${f(p.fromTop)} * (uPointerUV.y)`);
  return `(${terms.join(' + ')})`;
}

/** Gradient stops become a local const array; each effect owns its own program. */
function stopsArray(name: string, stops: Array<readonly number[]>): string {
  const body = stops.map(vec3).join(', ');
  return `  vec3 ${name}[MAX_STOPS] = vec3[MAX_STOPS](${body}${', vec3(0.0)'.repeat(
    Math.max(0, 8 - stops.length),
  )});`;
}

function sourceExpr(source: Source, uv: string, decls: string[], id: string): string {
  switch (source.kind) {
    case 'solid':
      return `srcSolid(${vec3(source.color)})`;
    case 'repeating-linear':
      decls.push(stopsArray(`stops_${id}`, source.stops));
      return `srcRepeatingLinear(${uv}, ${f(source.angleDeg)}, ${f(source.space)}, stops_${id}, ${source.stops.length})`;
    case 'linear':
      decls.push(stopsArray(`stops_${id}`, source.stops));
      return `srcLinear(${uv}, ${f(source.angleDeg)}, stops_${id}, ${source.stops.length})`;
    case 'radial-pointer':
      decls.push(
        stopsArray(
          `stops_${id}`,
          source.stops.map((s) => s.color),
        ),
      );
      return `srcRadialPointer(${uv}, stops_${id}, ${source.stops.length})`;
    case 'conic':
      decls.push(stopsArray(`stops_${id}`, source.stops));
      return `srcConic(${uv}, stops_${id}, ${source.stops.length})`;
    case 'glitter':
      return `srcGlitter(${uv}, ${f(source.scale)})`;
    case 'grain':
      return `srcGrain(${uv}, ${f(source.scale)})`;
    case 'card':
      return `srcCard(${uv})`;
    case 'scanlines':
      return `srcScanlines(${uv}, ${f(source.spacing)}, ${f(source.light)}, ${f(source.dark)})`;
  }
}

function layerCode(layer: Layer, index: number, prefix: string): string {
  const id = `${prefix}_${index}`;
  const decls: string[] = [];
  const size = layer.size ?? [1, 1];
  const ox = driven(layer.offset?.x, 0);
  const oy = driven(layer.offset?.y, 0);
  const uv = `uv_${id}`;
  const expr = sourceExpr(layer.source, uv, decls, id);

  return [
    ...decls,
    `  vec2 ${uv} = uvTransform(vUv, vec2(${f(size[0])}, ${f(size[1])}), vec2(${ox}, ${oy}));`,
    `  vec3 src_${id} = ${expr};`,
    index === 0
      ? `  vec3 stack_${prefix} = src_${id};`
      : `  stack_${prefix} = blendWith(${BLEND_ID[layer.blend]}, stack_${prefix}, src_${id});`,
  ].join('\n');
}

function filterCode(filter: Filter | undefined, prefix: string): string {
  const b = driven(filter?.brightness, 1);
  const c = driven(filter?.contrast, 1);
  const s = driven(filter?.saturate, 1);
  return `  stack_${prefix} = applyFilter(stack_${prefix}, ${b}, ${c}, ${s});`;
}

function elementCode(element: Element, prefix: string): string {
  const layers = element.layers.map((l, i) => layerCode(l, i, prefix)).join('\n');
  const opacity = driven(element.opacity, 1);
  return [
    `  // --- ${prefix}`,
    layers,
    filterCode(element.filter, prefix),
    `  acc = mix(acc, blendWith(${BLEND_ID[element.mixBlend]}, acc, stack_${prefix}), clamp(${opacity} * uCardOpacity, 0.0, 1.0));`,
  ].join('\n');
}

/** An Effect becomes one complete fragment shader, constants and all. */
export function compileEffect(effect: Effect): string {
  const shine = effect.shine.map((e, i) => elementCode(e, `shine${i}`)).join('\n\n');
  const glare = effect.glare.map((e, i) => elementCode(e, `glare${i}`)).join('\n\n');

  // NO `#version` directive here. three.js prepends `#version 300 es` itself
  // whenever `glslVersion` is set on the material (WebGLProgram.js builds
  // `'#version ' + parameters.glslVersion`, and GLSL3 === '300 es'). Emitting
  // one here too produces a duplicate directive, which is a compile error —
  // and one no test in this plan can catch, because ShaderMaterial is an inert
  // object until a GPU compiles it. The test below pins this.
  return `precision highp float;

// effect: ${effect.id}

${baseGLSL}
${sourcesGLSL}
${blendGLSL}

void main() {
  vec3 art = srcCard(vUv);
  vec3 acc = art;
  float cov = coverage(vUv);

${shine}

  // the foil only exists inside the clip region
  acc = mix(art, acc, cov);

  // Glare is applied AFTER the clip mix, so it is deliberately unclipped: it
  // sweeps the whole card while the shine stays inside the art window. That
  // mirrors the reference, where .card__shine carries the clip-path but
  // .card__glare covers the full card face. Moving this block above the mix
  // would confine the glare to the region and flatten the card's edges.
${glare}

  fragColor = vec4(acc, 1.0);
}
`;
}
