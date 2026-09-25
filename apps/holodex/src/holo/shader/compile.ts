import { BLEND_ID, blendGLSL } from './blend';
import { sourcesGLSL } from './sources';
import { baseGLSL, VERTEX_SHADER } from './base';
import { regionFor } from '../regions';
import type { Effect, Element, Filter, GradientStop, Layer, PointerDriven, Source } from './types';

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
  if (p.fromFoilBrightness) terms.push(`${f(p.fromFoilBrightness)} * uFoilBrightness`);
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
    case 'radial-pointer': {
      decls.push(
        stopsArray(
          `stops_${id}`,
          source.stops.map((s) => s.color),
        ),
      );
      if (source.cssBox) {
        // CSS's farthest-corner geometry (types.ts), for a radial css.ts converted
        const [cx, cy] = source.cssBox.centre.map((p) => driven(p, 0));
        const [w, h] = source.cssBox.size;
        return `srcRadialCss(${uv}, vec2(${cx}, ${cy}), vec2(${f(w)}, ${f(h)}), stops_${id}, ${source.stops.length})`;
      }
      return `srcRadialPointer(${uv}, stops_${id}, ${source.stops.length})`;
    }
    case 'conic':
      decls.push(stopsArray(`stops_${id}`, source.stops));
      return `srcConic(${uv}, stops_${id}, ${source.stops.length})`;
    case 'glitter':
      return `srcGlitter(${uv}, ${f(source.scale)})`;
    case 'grain':
      return `srcGrain(${uv}, ${f(source.scale)})`;
    case 'iri':
      return `srcIri(${uv}, ${f(source.scale)})`;
    case 'birthday':
      return `srcBirthday(${uv}, ${f(source.scale)})`;
    case 'pokeball':
      return `srcPokeball(${uv}, ${f(source.scale)})`;
    case 'pokeball-inner':
      return `srcPokeballInner(${uv}, ${f(source.scale)})`;
    case 'masterball':
      return `srcMasterball(${uv}, ${f(source.scale)})`;
    case 'masterball-inner':
      return `srcMasterballInner(${uv}, ${f(source.scale)})`;
    case 'geometric':
      return `srcGeometric(${uv}, ${f(source.scale)})`;
    case 'trainerbg':
      return `srcTrainerbg(${uv}, ${f(source.scale)})`;
    case 'illusion':
      return `srcIllusion(${uv}, ${f(source.scale)})`;
    case 'illusion-mask':
      return `srcIllusionMask(${uv}, ${f(source.scale)})`;
    case 'ancient':
      return `srcAncient(${uv}, ${f(source.scale)})`;
    case 'vmaxbg':
      return `srcVmaxbg(${uv}, ${f(source.scale)})`;
    case 'cosmos-bottom':
      return `srcCosmosBottom(${uv}, ${f(source.scale)})`;
    case 'cosmos-middle':
      return `srcCosmosMiddle(${uv}, ${f(source.scale)})`;
    case 'cosmos-top':
      return `srcCosmosTop(${uv}, ${f(source.scale)})`;
    case 'card':
      return `srcCard(${uv})`;
    case 'scanlines':
      return `srcScanlines(${uv}, ${f(source.spacing)}, ${f(source.light)}, ${f(source.dark)})`;
    case 'css-linear':
    case 'css-radial':
    case 'css-conic':
      throw new Error(`${source.kind} draws on the RGBA path only`);
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
  const blended = `blendWith(${BLEND_ID[layer.blend]}, stack_${prefix}, src_${id})`;

  return [
    ...decls,
    `  vec2 ${uv} = uvTransform(vUv, vec2(${f(size[0])}, ${f(size[1])}), vec2(${ox}, ${oy}));`,
    `  vec3 src_${id} = ${expr};`,
    index === 0
      ? `  vec3 stack_${prefix} = src_${id};`
      : layer.opacity
        ? // a layer's own opacity (types.ts): only so much of its blend shows
          `  stack_${prefix} = mix(stack_${prefix}, ${blended}, clamp(${driven(layer.opacity, 1)}, 0.0, 1.0));`
        : `  stack_${prefix} = ${blended};`,
  ].join('\n');
}

/**
 * A filter over `target`: the RGB path's whole stack through applyFilter, as
 * it always has, or an RGBA stack's colour through applyCssFilter, CSS's own
 * chain (sources.ts).
 */
function filterCall(
  filter: Filter | undefined,
  target: string,
  fn: 'applyFilter' | 'applyCssFilter' = 'applyFilter',
): string {
  const b = driven(filter?.brightness, 1);
  const c = driven(filter?.contrast, 1);
  const s = driven(filter?.saturate, 1);
  return `  ${target} = ${fn}(${target}, ${b}, ${c}, ${s});`;
}

/**
 * An element's `withinRegion` (types.ts) as a factor of its weight: main()'s
 * `cov`, the effect's region, which it computes before any element.
 */
function withinRegion(element: Element): string {
  return element.withinRegion ? ' * cov' : '';
}

/** An element on the RGB path: every element that uses no group, exact gradient or alpha texture. */
function rgbElementCode(element: Element, prefix: string): string {
  const layers = element.layers.map((l, i) => layerCode(l, i, prefix)).join('\n');
  const opacity = driven(element.opacity, 1);
  // An element's own clip (types.ts) gates its mix alone; the effect's clip
  // still applies to the whole shine after every element (compileEffect).
  const clip = element.clip ? regionFor(element.clip) : undefined;
  const weight = `clamp(${opacity} * uCardOpacity, 0.0, 1.0)${clip ? ` * clip_${prefix}` : ''}${withinRegion(element)}`;
  return [
    `  // --- ${prefix}`,
    layers,
    filterCall(element.filter, `stack_${prefix}`),
    ...(clip
      ? [
          `  float clip_${prefix} = insideRect(vUv, vec4(${f(clip.top)}, ${f(clip.right)}, ${f(clip.bottom)}, ${f(clip.left)}));`,
        ]
      : []),
    `  acc = mix(acc, blendWith(${BLEND_ID[element.mixBlend]}, acc, stack_${prefix}), ${weight});`,
  ].join('\n');
}

// ------------------------------------------------------------- the RGBA path

/**
 * Textures whose alpha channel is part of the picture: a layer of one takes
 * the RGBA path (needsRGBA) and is sampled there with its alpha; every other
 * texture is opaque.
 */
export const ALPHA_TEXTURES: ReadonlySet<Source['kind']> = new Set<Source['kind']>([
  'illusion-mask',
  'cosmos-middle',
  'cosmos-top',
]);

/** Each alpha texture's sampler on the RGBA path, which keeps its alpha (sources.ts). */
const ALPHA_SAMPLER: Partial<Record<Source['kind'], string>> = {
  'illusion-mask': 'srcIllusionMask4',
  'cosmos-middle': 'srcCosmosMiddle4',
  'cosmos-top': 'srcCosmosTop4',
};

/** sources.ts's MAX_CSS_STOPS. */
const MAX_CSS_STOPS = 32;

type ExactSource = Extract<Source, { kind: 'css-linear' | 'css-radial' | 'css-conic' }>;

const isExact = (source: Source): source is ExactSource =>
  source.kind === 'css-linear' || source.kind === 'css-radial' || source.kind === 'css-conic';

/**
 * Whether an element compiles to the RGBA path: it has children, or a layer
 * that is an exact gradient or a texture with alpha. Everything else keeps the
 * RGB path, byte for byte (effects/unchanged.test.ts pins it).
 */
export function needsRGBA(element: Element): boolean {
  if (element.children?.length) return true;
  return element.layers.some(({ source }) => isExact(source) || ALPHA_TEXTURES.has(source.kind));
}

/**
 * An exact gradient's stops, premultiplied (a glow mixed in first), and their
 * places, each padded to MAX_CSS_STOPS. The padding repeats the last place, so
 * a lookup past the last stop stays on it.
 */
function cssStopArrays(id: string, stops: GradientStop[]): string[] {
  if (stops.length > MAX_CSS_STOPS) {
    throw new Error(`${stops.length} stops: an exact gradient holds ${MAX_CSS_STOPS}`);
  }
  const pad = MAX_CSS_STOPS - stops.length;
  const colour = (s: GradientStop) => {
    const a = s.alpha ?? 1;
    return s.glow
      ? `vec4(mix(${vec3(s.color)}, uCardGlow, ${f(s.glow)}) * ${f(a)}, ${f(a)})`
      : `vec4(${f(s.color[0] * a)}, ${f(s.color[1] * a)}, ${f(s.color[2] * a)}, ${f(a)})`;
  };
  const last = f(stops[stops.length - 1].at);
  const colours = [...stops.map(colour), ...Array<string>(pad).fill('vec4(0.0)')];
  const places = [...stops.map((s) => f(s.at)), ...Array<string>(pad).fill(last)];
  return [
    `  vec4 stops_${id}[MAX_CSS_STOPS] = vec4[MAX_CSS_STOPS](${colours.join(', ')});`,
    `  float pos_${id}[MAX_CSS_STOPS] = float[MAX_CSS_STOPS](${places.join(', ')});`,
  ];
}

/** An exact gradient's colour and alpha: its stops, looked up at its own t. */
function exactExpr(source: ExactSource, decls: string[], id: string): string {
  decls.push(...cssStopArrays(id, source.stops));
  const lookup = (t: string) => `cssStops(stops_${id}, pos_${id}, ${source.stops.length}, ${t})`;
  switch (source.kind) {
    case 'css-linear': {
      const { a, b, c } = source.line;
      const t = `(${f(a)} * vUv.x + ${f(b)} * vUv.y + ${driven(c, 0)})`;
      return lookup(source.repeating ? `fract(${t})` : t);
    }
    case 'css-radial': {
      const [cx, cy] = source.centre.map((p) => driven(p, 0));
      const [ax, ay] = source.at.map((p) => driven(p, 0));
      const size = `vec2(${f(source.size[0])}, ${f(source.size[1])})`;
      const shape = source.ellipse ? '1.0' : '0.0';
      return lookup(`radialReach(vUv, vec2(${cx}, ${cy}), ${size}, vec2(${ax}, ${ay}), ${shape})`);
    }
    case 'css-conic': {
      const [cx, cy] = source.centre;
      return lookup(`conicTurn(vUv, vec2(${f(cx)}, ${f(cy)}), ${f(source.from)})`);
    }
  }
}

/** One layer on the RGBA path: its colour and alpha, composited onto the layers beneath. */
function rgbaLayerCode(layer: Layer, index: number, prefix: string): string {
  const id = `${prefix}_${index}`;
  const decls: string[] = [];
  const lines: string[] = [];
  let expr: string;
  if (isExact(layer.source)) {
    expr = exactExpr(layer.source, decls, id);
  } else {
    const size = layer.size ?? [1, 1];
    const ox = driven(layer.offset?.x, 0);
    const oy = driven(layer.offset?.y, 0);
    const uv = `uv_${id}`;
    lines.push(
      `  vec2 ${uv} = uvTransform(vUv, vec2(${f(size[0])}, ${f(size[1])}), vec2(${ox}, ${oy}));`,
    );
    const sampler = ALPHA_SAMPLER[layer.source.kind];
    const scale = 'scale' in layer.source ? layer.source.scale : 1;
    // an alpha texture keeps its alpha; every other older kind is opaque
    expr = sampler
      ? `${sampler}(${uv}, ${f(scale)})`
      : `vec4(${sourceExpr(layer.source, uv, decls, id)}, 1.0)`;
  }
  return [
    ...decls,
    ...lines,
    `  vec4 src_${id} = ${expr};`,
    ...(layer.opacity ? [`  src_${id}.a *= clamp(${driven(layer.opacity, 1)}, 0.0, 1.0);`] : []),
    `  stack_${prefix} = compositeOver(stack_${prefix}, src_${id}, ${BLEND_ID[layer.blend]});`,
  ].join('\n');
}

/** An element's own clip (types.ts) as a GLSL expression, 1 inside its rect. */
function insideRectOf(shape: NonNullable<Element['clip']>): string {
  const r = regionFor(shape);
  return `insideRect(vUv, vec4(${f(r.top)}, ${f(r.right)}, ${f(r.bottom)}, ${f(r.left)}))`;
}

/** A child: drawn whole inside its parent's group, then composited onto it. */
function childCode(child: Element, index: number, parent: string): string {
  if (child.children?.length) throw new Error('a child has no children of its own');
  const prefix = `${parent}_c${index}`;
  const clip = child.clip ? ` * ${insideRectOf(child.clip)}` : '';
  return [
    `  // --- ${prefix}`,
    `  vec4 stack_${prefix} = vec4(0.0);`,
    ...child.layers.map((l, i) => rgbaLayerCode(l, i, prefix)),
    filterCall(child.filter, `stack_${prefix}.rgb`, 'applyCssFilter'),
    `  stack_${prefix}.a *= clamp(${driven(child.opacity, 1)}, 0.0, 1.0)${clip};`,
    `  stack_${parent} = compositeOver(stack_${parent}, stack_${prefix}, ${BLEND_ID[child.mixBlend]});`,
  ].join('\n');
}

/**
 * An element on the RGBA path: its group — its layers, then each child —
 * filtered as one, then composited onto the card by its alpha, as CSS draws
 * an element with pseudo-elements.
 */
function rgbaElementCode(element: Element, prefix: string): string {
  const opacity = driven(element.opacity, 1);
  const clip = element.clip ? insideRectOf(element.clip) : undefined;
  const weight = `stack_${prefix}.a * clamp(${opacity} * uCardOpacity, 0.0, 1.0)${clip ? ` * clip_${prefix}` : ''}${withinRegion(element)}`;
  return [
    `  // --- ${prefix} (rgba)`,
    `  vec4 stack_${prefix} = vec4(0.0);`,
    ...element.layers.map((l, i) => rgbaLayerCode(l, i, prefix)),
    ...(element.children ?? []).map((c, i) => childCode(c, i, prefix)),
    filterCall(element.filter, `stack_${prefix}.rgb`, 'applyCssFilter'),
    ...(clip ? [`  float clip_${prefix} = ${clip};`] : []),
    `  acc = mix(acc, blendWith(${BLEND_ID[element.mixBlend]}, acc, stack_${prefix}.rgb), ${weight});`,
  ].join('\n');
}

function elementCode(element: Element, prefix: string): string {
  return needsRGBA(element) ? rgbaElementCode(element, prefix) : rgbElementCode(element, prefix);
}

/** An Effect becomes one complete fragment shader, constants and all. */
export function compileEffect(effect: Effect): string {
  const beneath = (effect.beneath ?? []).map((e, i) => elementCode(e, `beneath${i}`)).join('\n\n');
  const shine = effect.shine.map((e, i) => elementCode(e, `shine${i}`)).join('\n\n');
  const glare = effect.glare.map((e, i) => elementCode(e, `glare${i}`)).join('\n\n');
  // Glare the reference paints beneath its shine (types.ts) lies on the card
  // first, and the shine's clip keeps it: outside the region the card stays as
  // that glare left it, not as the bare art.
  const under = beneath ? `${beneath}\n\n  vec3 base = acc;\n` : '';
  const backdrop = beneath ? 'base' : 'art';
  // The glare below the clip mix is unclipped unless an element asks: a glare
  // the reference clips carries its own clip and withinRegion (types.ts).

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

${under}${shine}

  // the foil only exists inside the clip region
  acc = mix(${backdrop}, acc, cov);

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
