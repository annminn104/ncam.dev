import { Color, type Material, Matrix4, type Mesh, type Object3D, Vector3, Vector4 } from 'three';
import { owningNode } from '../scene/extras';
import { globalUniforms } from './uniforms';
import { WATER_STYLES } from './water';

/**
 * The most koi one object carries: the size of the shader's loop arrays (art/blender/scripts/pond/build_koi.py KOI_SLOTS).
 */
export const KOI_MAX = 16;
/** Floats per fish in the `koi` extras (pond/swim.py pack). */
export const KOI_STRIDE = 12;
/** Seconds either side of the moment: a koi heads the way it moved over this step (pond/swim.py EPS). */
export const KOI_EPS = 0.05;
/**
 * The koi draw after the water (render order 0), as transparent objects do, so the water's 0.7 opacity does not wash
 * them out to a brown smudge from the wallpaper camera; the vertex depth tints them towards the water instead
 * (patchKoiFragment).
 */
export const KOI_RENDER_ORDER = 1;
/** How much of the water's colour a koi takes: this much at the surface, more the deeper it swims, at most `max`. */
export const KOI_FADE = { surface: 0.05, perMetre: 1.0, max: 0.6 };
/**
 * Feeding (a click on the pond): the koi leave their loops for the food in `gather` seconds, circle it from then until
 * `stay` and are back on their loops by `leave`; every other koi on an inner ring `rings[0]` metres round the food and
 * `depths[0]` under the surface (their undersides), the others outside and a little deeper, the two rings turning
 * opposite ways at `spin` radians a second. Food thrown again while they are still fed glides the rings' middle to it
 * in `glide` seconds, the koi as far from their loops as they were (koiRefeed). pond/swim.py FEED has the same numbers.
 */
export const KOI_FEED = {
  gather: 3,
  stay: 9,
  leave: 13,
  glide: 1,
  rings: [0.45, 0.8],
  depths: [0.16, 0.25],
  spin: 0.4,
};
/** The tail's sway: `speed` radians a second on its own clock, wrapped after whole strokes; `amplitude` metres. */
export const KOI_SWAY = { speed: 6, amplitude: 0.03 };

/**
 * The food a click dropped, in the module's Blender space (the shared clock's times): where it fell and when, where the
 * rings' middle glides from to get there (the food before it; itself on a first feed) and when the koi set off for food
 * (when it fell, or earlier when it fell while they were still fed: their hunger goes on from where it was).
 */
export interface KoiFood {
  x: number;
  y: number;
  at: number;
  from: [number, number];
  start: number;
}

/** Where the food may land (koi_layout.FEEDING): the koi's rings round it stay off the rockery and the bank. */
export interface KoiFeedDisc {
  centre: [number, number];
  radius: number;
}

/** One koi's loop in the module's Blender space (x, y, z up), as pond/swim.py packs it. */
export interface KoiLoop {
  centre: [number, number];
  radii: [number, number];
  /** radians */
  tilt: number;
  /** the height of the fish's underside */
  z: number;
  /** radians a second; negative: clockwise seen from above */
  omega: number;
  phase: number;
  /** 1: a figure of eight */
  eight: number;
  bob: number;
}

/**
 * The koi loops of a `koi` extras list, or null (with a warning) when it is not a list of whole fish the shader holds.
 */
export function readKoi(extras: unknown): KoiLoop[] | null {
  if (!Array.isArray(extras)) return null;
  const count = extras.length / KOI_STRIDE;
  if (
    !Number.isInteger(count) ||
    count === 0 ||
    count > KOI_MAX ||
    !extras.every((v) => typeof v === 'number')
  ) {
    console.warn(
      `[koi] ${extras.length} floats are not 1..${KOI_MAX} koi of ${KOI_STRIDE}, skipped`,
    );
    return null;
  }
  const values = extras as number[];
  return Array.from({ length: count }, (_, i) => {
    const [cx, cy, rx, ry, tilt, z, omega, phase, eight, bob] = values.slice(
      i * KOI_STRIDE,
      (i + 1) * KOI_STRIDE,
    );
    return { centre: [cx, cy], radii: [rx, ry], tilt, z, omega, phase, eight, bob };
  });
}

/**
 * Where a koi is at time t (Blender x, y and its underside's z): pond/swim.py position, as the vertex shader has it.
 */
export function koiPosition(loop: KoiLoop, t: number): [number, number, number] {
  const s = loop.phase + loop.omega * t;
  const ex = loop.radii[0] * Math.cos(s);
  const ey = loop.radii[1] * (loop.eight ? Math.sin(2 * s) : Math.sin(s));
  const c = Math.cos(loop.tilt);
  const n = Math.sin(loop.tilt);
  return [
    loop.centre[0] + c * ex - n * ey,
    loop.centre[1] + n * ex + c * ey,
    loop.z + loop.bob * Math.sin(2 * s),
  ];
}

/** A koi's turn about Blender's Z at time t: its nose, local -Y, points the way it moves (pond/swim.py heading). */
export function koiHeading(loop: KoiLoop, t: number): number {
  const [x0, y0] = koiPosition(loop, t - KOI_EPS);
  const [x1, y1] = koiPosition(loop, t + KOI_EPS);
  return Math.atan2(x1 - x0, -(y1 - y0));
}

/** The feeding disc of a `koi_feed` extras list (x, y, radius), or null when it is not one. */
export function readKoiFeed(extras: unknown): KoiFeedDisc | null {
  if (
    !Array.isArray(extras) ||
    extras.length !== 3 ||
    !extras.every((v) => typeof v === 'number' && Number.isFinite(v))
  )
    return null;
  const [x, y, radius] = extras as number[];
  return radius > 0 ? { centre: [x, y], radius } : null;
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** How far the koi have left their loops `dt` seconds after they set off for food: 0 to 1 and back to 0 (KOI_FEED). */
export function koiHunger(dt: number): number {
  return smoothstep(0, KOI_FEED.gather, dt) * (1 - smoothstep(KOI_FEED.stay, KOI_FEED.leave, dt));
}

/** The rings' middle at time `now`: gliding from `food.from` to where the food fell, in KOI_FEED.glide seconds. */
export function koiFoodCentre(food: KoiFood, now: number): [number, number] {
  const k = smoothstep(food.at, food.at + KOI_FEED.glide, now);
  return [food.from[0] + (food.x - food.from[0]) * k, food.from[1] + (food.y - food.from[1]) * k];
}

/** Where koi `index` of `count` circles the food at time `now` (Blender x, y and its underside's z). */
export function koiGather(
  index: number,
  count: number,
  food: KoiFood,
  now: number,
  waterZ: number,
): [number, number, number] {
  const ring = index % 2;
  const angle = (2 * Math.PI * index) / count + now * KOI_FEED.spin * (ring ? -1 : 1);
  const [x, y] = koiFoodCentre(food, now);
  const r = KOI_FEED.rings[ring];
  return [x + r * Math.cos(angle), y + r * Math.sin(angle), waterZ - KOI_FEED.depths[ring]];
}

/** koiPosition with the food: koi `index` of `count` at loop time t and clock time `now`, as the vertex shader does. */
export function koiFedPosition(
  loop: KoiLoop,
  t: number,
  now: number,
  index: number,
  count: number,
  food: KoiFood | null,
  waterZ: number,
): [number, number, number] {
  const swim = koiPosition(loop, t);
  const hunger = food ? koiHunger(now - food.start) : 0;
  if (!food || hunger <= 0) return swim;
  const gather = koiGather(index, count, food, now, waterZ);
  return [0, 1, 2].map((k) => swim[k] + (gather[k] - swim[k]) * hunger) as [number, number, number];
}

/** Where food thrown at `point` (Blender x, y) lands: there, or on the rim of the feeding disc when it fell outside. */
export function koiFeedTarget(disc: KoiFeedDisc, point: [number, number]): [number, number] {
  const [cx, cy] = disc.centre;
  const away = Math.hypot(point[0] - cx, point[1] - cy);
  if (away <= disc.radius) return [point[0], point[1]];
  const k = disc.radius / away;
  return [cx + (point[0] - cx) * k, cy + (point[1] - cy) * k];
}

/**
 * The food that falls on `point` at `at` after `previous` (null: none yet). While the koi are still fed, the rings'
 * middle glides from where it is to the new food and they set off as long ago as it takes their hunger to rise to where
 * it is (koiHunger's rise, inverted): no koi jumps, and those that were circling the food stay a full while.
 */
export function koiRefeed(previous: KoiFood | null, point: [number, number], at: number): KoiFood {
  const hunger = previous ? koiHunger(at - previous.start) : 0;
  if (!previous || !(hunger > 0))
    return { x: point[0], y: point[1], at, from: [point[0], point[1]], start: at };
  // smoothstep's inverse: 3s² - 2s³ = h for s = 1/2 - sin(asin(1 - 2h) / 3)
  const rise = KOI_FEED.gather * (0.5 - Math.sin(Math.asin(1 - 2 * hunger) / 3));
  return { x: point[0], y: point[1], at, from: koiFoodCentre(previous, at), start: at - rise };
}

// The vertex shader works in the module's Blender space: uKoiSpace takes a vertex there from the mesh's own (quantized)
// space, glTF axes (x, y up, z = -Blender y). A fish was built where its loop starts, heading the way it swims there:
// the shader takes it back to its own space, sways its tail, and stands it where its loop has it now.
const KOI_PARS = /* glsl */ `
attribute vec2 koiFish;
uniform float uTime;
uniform vec4 uKoiA[${KOI_MAX}];
uniform vec4 uKoiB[${KOI_MAX}];
uniform vec4 uKoiC[${KOI_MAX}];
uniform mat4 uKoiSpace;
uniform mat4 uKoiSpaceInv;
uniform float uKoiWater;
uniform vec4 uKoiFeed;
uniform vec4 uKoiFeedFrom;
uniform float uKoiCount;
varying float vKoiDepth;
vec3 koiPath(int i, float t) {
  vec4 a = uKoiA[i];
  vec4 b = uKoiB[i];
  vec4 c = uKoiC[i];
  float s = b.w + b.z * t;
  vec2 e = vec2(a.z * cos(s), a.w * mix(sin(s), sin(2.0 * s), c.x));
  vec2 r = vec2(cos(b.x), sin(b.x));
  return vec3(a.xy + vec2(r.x * e.x - r.y * e.y, r.y * e.x + r.x * e.y), b.y + c.y * sin(2.0 * s));
}
float koiYaw(int i, float t) {
  vec3 d = koiPath(i, t + ${KOI_EPS.toFixed(2)}) - koiPath(i, t - ${KOI_EPS.toFixed(2)});
  return atan(d.x, -d.y);
}
// fed, the koi leave their loops for rings round the food (KOI_FEED, koiFedPosition): uKoiFeed is where it fell, when,
// and 1 once fed, uKoiFeedFrom where the rings' middle glides from and when the koi set off; the rings turn on the
// shared clock, wrapped after a whole turn
vec3 koiAt(int i, float t, float now) {
  vec3 p = koiPath(i, t);
  float dt = now - uKoiFeedFrom.z;
  float w = uKoiFeed.w * smoothstep(0.0, ${KOI_FEED.gather.toFixed(1)}, dt)
    * (1.0 - smoothstep(${KOI_FEED.stay.toFixed(1)}, ${KOI_FEED.leave.toFixed(1)}, dt));
  if (w <= 0.0) return p;
  vec2 food = mix(uKoiFeedFrom.xy, uKoiFeed.xy, smoothstep(uKoiFeed.z, uKoiFeed.z + ${KOI_FEED.glide.toFixed(1)}, now));
  float ring = mod(float(i), 2.0);
  float turn = mod(now, ${((2 * Math.PI) / KOI_FEED.spin).toFixed(7)}) * ${KOI_FEED.spin.toFixed(2)};
  float a = 6.2831853 * float(i) / uKoiCount + turn * (1.0 - 2.0 * ring);
  vec2 ringAt = food + mix(${KOI_FEED.rings[0].toFixed(2)}, ${KOI_FEED.rings[1].toFixed(2)}, ring) * vec2(cos(a), sin(a));
  return mix(p, vec3(ringAt, uKoiWater - mix(${KOI_FEED.depths[0].toFixed(2)}, ${KOI_FEED.depths[1].toFixed(2)}, ring)), w);
}
float koiYawAt(int i, float t, float now) {
  vec3 d = koiAt(i, t + ${KOI_EPS.toFixed(2)}, now + ${KOI_EPS.toFixed(2)}) - koiAt(i, t - ${KOI_EPS.toFixed(2)}, now - ${KOI_EPS.toFixed(2)});
  return atan(d.x, -d.y);
}
vec2 koiTurn(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
`;

const KOI_NORMAL = /* glsl */ `
  int koiI = int(koiFish.x * ${KOI_MAX.toFixed(1)});
  float koiT = mod(uTime, 6.2831853 / abs(uKoiB[koiI].z));
  vec3 koiStart = koiPath(koiI, 0.0);
  float koiYaw0 = koiYaw(koiI, 0.0);
  vec3 koiNow = koiAt(koiI, koiT, uTime);
  float koiYawT = koiYawAt(koiI, koiT, uTime);
  vec4 koiM = uKoiSpace * vec4(position, 1.0);
  vec3 koiB = vec3(koiM.x, -koiM.z, koiM.y);
  vec2 koiLocal = koiTurn(koiB.xy - koiStart.xy, -koiYaw0);
  float koiSway = mod(uTime, ${((2 * Math.PI) / KOI_SWAY.speed).toFixed(7)}) * ${KOI_SWAY.speed.toFixed(1)}; // whole strokes: no snap
  koiLocal.x += ${KOI_SWAY.amplitude.toFixed(2)} * smoothstep(-0.1, 0.24, koiLocal.y) * sin(koiSway + uKoiB[koiI].w * 3.0 - koiLocal.y * 12.0);
  vec3 koiMoved = vec3(koiNow.xy + koiTurn(koiLocal, koiYawT), koiNow.z + koiB.z - koiStart.z);
  vec3 koiN = mat3(uKoiSpace) * objectNormal;
  vec2 koiNT = koiTurn(vec2(koiN.x, -koiN.z), koiYawT - koiYaw0);
  objectNormal = mat3(uKoiSpaceInv) * vec3(koiNT.x, koiN.y, -koiNT.y);
  vKoiDepth = uKoiWater - koiMoved.z;
`;

const KOI_MOVE = /* glsl */ `
  transformed = (uKoiSpaceInv * vec4(koiMoved.x, koiMoved.z, -koiMoved.y, 1.0)).xyz;
`;

export function patchKoiVertex(source: string): string {
  for (const chunk of [
    '#include <common>',
    '#include <beginnormal_vertex>',
    '#include <begin_vertex>',
  ]) {
    if (!source.includes(chunk))
      throw new Error('koi: expected <common>, <beginnormal_vertex> and <begin_vertex> chunks');
  }
  return source
    .replace('#include <common>', `#include <common>\n${KOI_PARS}`)
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${KOI_NORMAL}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${KOI_MOVE}`);
}

const KOI_TINT = /* glsl */ `
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uKoiTint * mix(1.0, 0.3, uNight), clamp(${KOI_FADE.surface.toFixed(2)} + vKoiDepth * ${KOI_FADE.perMetre.toFixed(2)}, 0.0, ${KOI_FADE.max.toFixed(2)}));
`;

export function patchKoiFragment(source: string): string {
  if (!source.includes('#include <common>') || !source.includes('#include <opaque_fragment>')) {
    throw new Error('koi: expected <common> and <opaque_fragment> chunks');
  }
  return source
    .replace(
      '#include <common>',
      '#include <common>\nuniform vec3 uKoiTint;\nuniform float uNight;\nvarying float vKoiDepth;',
    )
    .replace('#include <opaque_fragment>', `#include <opaque_fragment>\n${KOI_TINT}`);
}

/** The uniforms of one koi material that the website changes after it is prepared: the food (feedKoi, setKoiFood). */
export interface KoiUniforms {
  uKoiFeed: { value: Vector4 };
  uKoiFeedFrom: { value: Vector4 };
}

/**
 * One koi material of a prepared module (prepareModule's `koi`): its uniforms, its fish's loops and their feeding disc.
 */
export interface PreparedKoi {
  uniforms: KoiUniforms;
  loops: KoiLoop[];
  feed: KoiFeedDisc | null;
}

/** The food the uniforms of a koi material hold, or null while they are unfed. */
export function koiFoodOf(uniforms: KoiUniforms): KoiFood | null {
  const [x, y, at, fed] = uniforms.uKoiFeed.value.toArray();
  const [fx, fy, start] = uniforms.uKoiFeedFrom.value.toArray();
  return fed ? { x, y, at, from: [fx, fy], start } : null;
}

/**
 * Gives the koi of a material `food`: uKoiFeed where it fell, when and 1 (fed), uKoiFeedFrom the glide's start and
 * set-off.
 */
export function setKoiFood(uniforms: KoiUniforms, food: KoiFood): void {
  uniforms.uKoiFeed.value.set(food.x, food.y, food.at, 1);
  uniforms.uKoiFeedFrom.value.set(food.from[0], food.from[1], food.start, 0);
}

/**
 * Makes a koi material swim its fish (a clone of its own: the patch reads attributes only the koi have). `space` is the
 * mesh's matrix in the module (its quantization included), `waterZ` the water's height in the module's Blender space.
 */
export function applyKoi(
  material: Material,
  loops: KoiLoop[],
  space: Matrix4,
  waterZ: number,
): KoiUniforms {
  const pack = (f: (loop: KoiLoop) => [number, number, number, number]) =>
    Array.from({ length: KOI_MAX }, (_, i) =>
      i < loops.length ? new Vector4(...f(loops[i])) : new Vector4(),
    );
  const uniforms = {
    uKoiA: { value: pack((l) => [l.centre[0], l.centre[1], l.radii[0], l.radii[1]]) },
    uKoiB: { value: pack((l) => [l.tilt, l.z, l.omega, l.phase]) },
    uKoiC: { value: pack((l) => [l.eight, l.bob, 0, 0]) },
    uKoiSpace: { value: space.clone() },
    uKoiSpaceInv: { value: space.clone().invert() },
    uKoiWater: { value: waterZ },
    uKoiTint: {
      value: new Color().copy(WATER_STYLES.pond.deep).lerp(WATER_STYLES.pond.shallow, 0.35),
    }, // the pond's water
    uKoiFeed: { value: new Vector4(0, 0, 0, 0) }, // unfed: w 0 (a Vector4 starts with w 1)
    uKoiFeedFrom: { value: new Vector4(0, 0, 0, 0) },
    uKoiCount: { value: loops.length },
  };
  material.userData.koi = true;
  material.transparent = true; // drawn after the water, which draws in the transparent pass too
  material.depthWrite = true;
  material.forceSinglePass = true; // glTF doubleSided: three would draw a transparent fish twice, back then front faces
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, {
      uTime: globalUniforms.uTime,
      uNight: globalUniforms.uNight,
    });
    shader.vertexShader = patchKoiVertex(shader.vertexShader);
    shader.fragmentShader = patchKoiFragment(shader.fragmentShader);
  };
  material.customProgramCacheKey = () => 'koi';
  material.needsUpdate = true;
  return uniforms;
}

/** What the pond's koi node carries: the loops its fish swim, the water's height and where they may be fed. */
export interface KoiNode {
  loops: KoiLoop[];
  waterZ: number;
  /** null: the node names no feeding disc (koi_feed), and a click on the pond feeds no koi */
  feed: KoiFeedDisc | null;
}

/** The loops, the water height and the feeding disc the glTF node of `object` carries, when it is the pond's koi. */
export function koiOf(object: Object3D): KoiNode | null {
  const {
    koi,
    koi_water: waterZ,
    koi_feed: feed,
  } = owningNode(object).userData as Record<string, unknown>;
  if (koi === undefined) return null;
  const loops = readKoi(koi);
  if (!loops || typeof waterZ !== 'number') return null;
  const disc = readKoiFeed(feed);
  if (!disc) console.warn('[koi] no feeding disc (koi_feed): a click on the pond feeds no koi');
  return { loops, waterZ, feed: disc };
}

/**
 * Wires one mesh of the pond's Koi node (art/blender/scripts/pond/build_koi.py) into the koi shader: its own material
 * clones, the fish numbers of the "koi" UV map (three's uv1) as koiFish, drawn after the water and never culled (the
 * fish leave the bounds they were built in). `root` is the module's root, which the shader's module space is measured
 * from.
 */
export function prepareKoi(mesh: Mesh, root: Object3D, koi: KoiNode): PreparedKoi[] {
  root.updateMatrixWorld(true);
  const space = new Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
  const numbers = mesh.geometry.getAttribute('uv1');
  if (numbers) {
    // geometry is shared between clones: the first one renames it, later ones find koiFish already
    mesh.geometry.setAttribute('koiFish', numbers);
    mesh.geometry.deleteAttribute('uv1');
  }
  const prepared: PreparedKoi[] = [];
  const swim = (material: Material) => {
    const own = material.clone();
    prepared.push({
      uniforms: applyKoi(own, koi.loops, space, koi.waterZ),
      loops: koi.loops,
      feed: koi.feed,
    });
    return own;
  };
  mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swim) : swim(mesh.material);
  mesh.renderOrder = KOI_RENDER_ORDER;
  mesh.frustumCulled = false;
  mesh.raycast = () => {}; // drawn where the shader swims them, not where they were built: a click goes to the water
  return prepared;
}

/**
 * Drops the food a click put on the pond (`point`, world space, at clock time `at`) for the koi of a prepared module
 * whose root is `root`: in the module's Blender space, inside its feeding disc (koiFeedTarget); food thrown while the
 * koi are still fed glides their rings there (koiRefeed).
 */
export function feedKoi(
  prepared: { koi: PreparedKoi[] },
  root: Object3D,
  food: { point: [number, number, number]; at: number },
): void {
  if (!prepared.koi.length) return;
  const local = root.worldToLocal(new Vector3(...food.point));
  for (const { uniforms, feed } of prepared.koi) {
    if (!feed) continue;
    setKoiFood(
      uniforms,
      koiRefeed(koiFoodOf(uniforms), koiFeedTarget(feed, [local.x, -local.z]), food.at),
    );
  }
}
