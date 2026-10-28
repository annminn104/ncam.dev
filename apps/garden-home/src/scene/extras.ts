import {
  BufferAttribute,
  type BufferGeometry,
  type Material,
  type Mesh,
  type Object3D,
  type PointLight,
  type SpotLight,
} from 'three';

export type HotspotAction = 'toggle' | 'play' | 'focus';

export interface Hotspot {
  name: string;
  action: HotspotAction;
  clip: string | null;
  label: string;
  radius: number;
  object: Object3D;
}

const ACTIONS: readonly string[] = ['toggle', 'play', 'focus'];
const DEFAULT_RADIUS = 0.5;

/** Reads HS_* empties. GLTFLoader puts glTF extras into Object3D.userData. */
export function extractHotspots(root: Object3D): Hotspot[] {
  const hotspots: Hotspot[] = [];
  root.traverse((object) => {
    if (!object.name.startsWith('HS_')) return;
    const { action, clip, label, radius } = object.userData as Record<string, unknown>;
    if (typeof action !== 'string' || !ACTIONS.includes(action)) {
      console.warn(`[extras] ${object.name}: unknown action ${String(action)}, skipped`);
      return;
    }
    const name = object.name.slice('HS_'.length);
    hotspots.push({
      name,
      action: action as HotspotAction,
      clip: typeof clip === 'string' ? clip : null,
      label: typeof label === 'string' ? label : name,
      radius: typeof radius === 'number' && radius > 0 ? radius : DEFAULT_RADIUS,
      object,
    });
  });
  return hotspots;
}

/**
 * The glTF node an object stands for. GLTFLoader records the original node name in userData.name, but a mesh does
 * not always sit on its node: gltf-transform moves the mesh of an animated or parent node into an unnamed child
 * (the pond's Fish), and a multi-primitive mesh becomes a named Group of Meshes named after the mesh data. In both
 * cases the node name and its extras live on the nearest ancestor that carries userData.name. Objects without any
 * glTF node name (hand-built ones) stand for themselves.
 */
export function owningNode(object: Object3D): Object3D {
  let node = object;
  while (node.userData.name === undefined && node.parent) node = node.parent;
  return node.userData.name === undefined ? object : node;
}

function nodeName(object: Object3D): string {
  const node = owningNode(object);
  return typeof node.userData.name === 'string' ? node.userData.name : node.name;
}

export function isNightLight(object: Object3D): boolean {
  const flag = owningNode(object).userData.night_light;
  return flag === true || flag === 1;
}

/** The foam at the foot of falling water: a *_foam node (the pond's Waterfall_foam), shown with its group's water. */
export function isFoam(object: Object3D): object is Mesh {
  return (object as Mesh).isMesh === true && /.+_foam$/.test(nodeName(object));
}

export function isWater(object: Object3D): object is Mesh {
  return (object as Mesh).isMesh === true && nodeName(object).startsWith('WATER_');
}

/** GLASS_* materials: clear panes, which the runtime keeps glossy. */
export function isClearGlass(material: Material): boolean {
  return material.name.startsWith('GLASS_');
}

/** GLASS_* and FROSTED_* materials: alpha-blended panes that reflect the sky environment. */
export function isGlass(material: Material): boolean {
  return isClearGlass(material) || material.name.startsWith('FROSTED_');
}

/**
 * M_sheer (art/README.md, Interior): the curtains' see-through voile, which a click goes through like a pane
 * and which prepareModule draws in one pass, lit from both sides.
 */
export function isSheer(material: Material): boolean {
  return material.name === 'M_sheer';
}

/** GLOW_* materials (art/README.md, Garden): the pools of light under the garden lamps, drawn additively over the ground. */
export function isGlow(material: Material): boolean {
  return material.name.startsWith('GLOW_');
}

/**
 * Objects the dollhouse cut clips at the void's plane rather than at their storey's cut (AGENTS.md, Controls;
 * houses/interact.py uncut): the crystal chandelier hangs in the double-height living room's void, over the ground
 * floor's cut, and would vanish from the room it lights.
 */
export function isUncut(object: Object3D): boolean {
  const flag = owningNode(object).userData.uncut;
  return flag === true || flag === 1;
}

/**
 * Objects the basement tags buried (basement/interact.py buried): its rooms under the plinth, which the website draws
 * only while it cuts the house down to the basement (cutaway.ts), never on the wallpaper.
 */
export function isBuried(object: Object3D): boolean {
  const flag = owningNode(object).userData.buried;
  return flag === true || flag === 1;
}

/**
 * Objects the interior tags detail (interior/interior_layout.py DETAILS): its small
 * things, a pixel or two from afar, which the website draws only while the camera is near the house (cutaway.ts
 * applyCut), never on the wallpaper.
 */
export function isDetail(object: Object3D): boolean {
  const flag = owningNode(object).userData.detail;
  return flag === true || flag === 1;
}

/**
 * Where the void's plane may come down to for an uncut object under the ground floor's cut: its cut_top extra, the
 * height of its top (the chandelier's crown) in module space, metres; null without one.
 */
export function cutTop(object: Object3D): number | null {
  const top = owningNode(object).userData.cut_top;
  return typeof top === 'number' && Number.isFinite(top) ? top : null;
}

/**
 * The opening an object stands in (basement/basement_layout.py OPENINGS): the light well's top, the stair's hole in the
 * ground slab, which the website sees the basement through while it does not cut the house down to it: its rectangle
 * (x0, y0, x1, y1, z) in Blender module space; null without one.
 */
export function openingOf(object: Object3D): [number, number, number, number, number] | null {
  const rect = owningNode(object).userData.opening;
  if (
    !Array.isArray(rect) ||
    rect.length !== 5 ||
    !rect.every((v) => typeof v === 'number' && Number.isFinite(v))
  )
    return null;
  return rect as [number, number, number, number, number];
}

/** Objects exported with cast_shadow = False (the garden's paving, low beds, rim tufts): left out of the shadow pass. */
export function castsNoShadow(object: Object3D): boolean {
  const flag = owningNode(object).userData.cast_shadow;
  return flag === false || flag === 0;
}

/** Point and spot lights from KHR_lights_punctual (GLTFLoader makes the light the glTF node itself). */
export function isPunctualLight(object: Object3D): object is PointLight | SpotLight {
  return (object as PointLight).isPointLight === true || (object as SpotLight).isSpotLight === true;
}

/** COLOR_0.r -> 1-component 'windWeight' attribute; null when the mesh has no wind paint. */
export function extractWindWeights(geometry: BufferGeometry): BufferAttribute | null {
  const color = geometry.getAttribute('color');
  if (!color) return null;
  const weights = new Float32Array(color.count);
  for (let i = 0; i < color.count; i++) weights[i] = color.getX(i);
  return new BufferAttribute(weights, 1);
}
