import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Matrix4, Vector3, type Group, type Material, type Mesh, type Object3D } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MODELS, type ModelId } from '../models';
import type { Slots, TurntableSlots } from '../scene/materials';
import { readContract, type CdModel, type PlayerModel, type VinylModel } from '../scene/model';
import { SCENE_PROFILES } from '../scene/profiles';
import { LUXE_RECORD, LUXE_SLEEVE } from './model-measures';

/**
 * What the clearance tests share (src/scene/ornament-clearance.test.ts, src/scene/rig.test.ts): a
 * committed GLB loaded as the page loads it and a model made of it, its ornament, and one measure
 * of how far a point, or a box, stands from a record, a sleeve or a disc as the rig poses it.
 *
 * Vertex-exact: a point is taken into the item's own frame and measured there, and the distance is
 * brought back to the world's by the item's scale, which the rig sets on a copy as it shrinks away
 * or grows in (uniformly, so the one factor is exact).
 */

/** The clearance every flight keeps off the ornament and off Luxe's dancer: 5 mm. */
export const CLEARANCE = 0.005;

/** A sleeve's half thickness (vinyl.py's SLEEVE_T, 3 mm). */
const SLEEVE_HALF_T = 0.0015;

/**
 * How far past an item's own reach an ornament vertex is measured: further off, it cannot be the
 * closest that counts, and within it the least distance at rest is a number, not Infinity.
 */
const REACH = 0.03;

/** A committed GLB as the page loads it: three's GLTFLoader with the meshopt decoder. */
export async function loadGlb(file: string): Promise<Group> {
  const bytes = readFileSync(file);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await loader.parseAsync(data as ArrayBuffer, '');
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

/** The committed GLB of model `id` (src/models.ts names its path under public/). */
export function glbOf(id: ModelId): string {
  const profile = MODELS.find((model) => model.id === id);
  if (!profile) throw new Error(`no model ${id}`);
  return fileURLToPath(new URL(`../../public/${profile.glb}`, import.meta.url));
}

/**
 * Model `id` made of its GLB as the page makes it: the nodes its media needs and the optional ones
 * it has, read by the page's own readContract, which every print must pass too. Its materials keep
 * the GLB's, unprinted.
 */
export function glbModel(root: Group, id: ModelId): PlayerModel {
  const prints: Record<string, Material> = {};
  root.traverse((object: Object3D) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    for (const material of [mesh.material].flat()) prints[material.name] ??= material;
  });
  const media = SCENE_PROFILES[id].media;
  const { nodes, missing } = readContract(root, prints, media);
  if (missing.length) throw new Error(`${id}'s GLB is missing ${missing.join(', ')}`);
  const loaded = { id, root, optionalSlots: {}, dispose: () => {}, applyLook: () => {} };
  return media === 'cd'
    ? { ...loaded, media, nodes: nodes as CdModel['nodes'], slots: prints as unknown as Slots }
    : {
        ...loaded,
        media,
        nodes: nodes as VinylModel['nodes'],
        slots: prints as unknown as TurntableSlots,
      };
}

/** The world-space vertices of every ornament mesh (`*_orn_*`) under `root`. */
export function ornamentOf(root: Object3D): Vector3[] {
  const out: Vector3[] = [];
  root.traverse((child: Object3D) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.name.includes('_orn_')) return;
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      out.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
    }
  });
  return out;
}

/**
 * An item measured in its own frame: a point's distance to it, and its reach (the radius round its
 * origin that holds all of it).
 */
export interface Measure {
  distance: (p: Vector3) => number;
  reach: number;
}

/** A record (its face local XZ): a solid disc. */
export const toRecord: Measure = {
  distance: (p) =>
    Math.hypot(
      Math.max(Math.hypot(p.x, p.z) - LUXE_RECORD.radius, 0),
      Math.max(Math.abs(p.y) - LUXE_RECORD.half, 0),
    ),
  reach: Math.hypot(LUXE_RECORD.radius, LUXE_RECORD.half),
};

/** A sleeve (its face local XZ): a box. */
export const toSleeve: Measure = {
  distance: (p) =>
    Math.hypot(
      Math.max(Math.abs(p.x) - LUXE_SLEEVE.half, 0),
      Math.max(Math.abs(p.y) - SLEEVE_HALF_T, 0),
      Math.max(Math.abs(p.z) - LUXE_SLEEVE.half, 0),
    ),
  reach: Math.hypot(LUXE_SLEEVE.half, SLEEVE_HALF_T, LUXE_SLEEVE.half),
};

/** The GLB's disc in its own frame (its face local XZ): its radius and its two faces' heights. */
export interface DiscShape {
  radius: number;
  bottom: number;
  top: number;
}

/** A CD of `shape`: a solid disc. */
export function toDisc(shape: DiscShape): Measure {
  return {
    distance: (p) =>
      Math.hypot(
        Math.max(Math.hypot(p.x, p.z) - shape.radius, 0),
        Math.max(shape.bottom - p.y, p.y - shape.top, 0),
      ),
    reach: Math.hypot(shape.radius, Math.max(Math.abs(shape.bottom), Math.abs(shape.top))),
  };
}

/** `disc`'s meshes measured in its own frame. */
export function discShape(disc: Object3D): DiscShape {
  const toFrame = new Matrix4().copy(disc.matrixWorld).invert();
  const shape = { radius: 0, bottom: Infinity, top: -Infinity };
  const p = new Vector3();
  disc.traverse((child: Object3D) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position');
    const matrix = toFrame.clone().multiply(mesh.matrixWorld);
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(matrix);
      shape.radius = Math.max(shape.radius, Math.hypot(p.x, p.z));
      shape.bottom = Math.min(shape.bottom, p.y);
      shape.top = Math.max(shape.top, p.y);
    }
  });
  return shape;
}

/**
 * The world distance from a point to the item `object` poses, as `measure` takes it in the item's
 * own frame, or Infinity for a point further than `within` from all of it. A copy the rig shrinks
 * carries a scale (`setScalar`, the same on every axis): a distance in its frame is the world's over
 * that scale, so the scale brings it back.
 */
export function distanceTo(
  object: Object3D,
  measure: Measure,
  within = REACH,
): (p: Vector3) => number {
  object.updateMatrixWorld(true);
  const toItem = new Matrix4().copy(object.matrixWorld).invert();
  const scale = object.matrixWorld.getMaxScaleOnAxis();
  const centre = new Vector3().setFromMatrixPosition(object.matrixWorld);
  const reach = (measure.reach * scale + within) ** 2;
  const local = new Vector3();
  return (p) =>
    p.distanceToSquared(centre) > reach
      ? Infinity
      : measure.distance(local.copy(p).applyMatrix4(toItem)) * scale;
}

/**
 * The least world distance from `points` to the item `object` poses (distanceTo), or Infinity when
 * none of them lies within REACH of the item.
 */
export function closest(points: readonly Vector3[], object: Object3D, measure: Measure): number {
  const distance = distanceTo(object, measure);
  let least = Infinity;
  for (const p of points) least = Math.min(least, distance(p));
  return least;
}

/** How close closestOn comes to the true distance: half a millimetre. */
const SURFACE_TOLERANCE = 0.0005;

/**
 * A surface mapped from a rectangle of two parameters, `s` and `t`: its point at (s, t), and the most
 * any point of the part [s0, s1] × [t0, t1] stands from the part's middle one.
 */
interface Surface {
  s: readonly [number, number];
  t: readonly [number, number];
  point: (s: number, t: number, into: Vector3) => Vector3;
  spread: (s0: number, s1: number, t0: number, t1: number) => number;
}

/**
 * The least world distance from `surfaces` to the item `object` poses (distanceTo), never below
 * the true one and at most SURFACE_TOLERANCE above it. Each surface is cut in four, and each part
 * again, but only while it could hold a point closer than the closest found yet: no point of a part
 * stands nearer than its middle's distance less its spread.
 */
function closestOn(surfaces: readonly Surface[], object: Object3D, measure: Measure): number {
  const distance = distanceTo(object, measure, Infinity);
  const parts = surfaces.map((surface) => ({ surface, s: surface.s, t: surface.t }));
  const point = new Vector3();
  let least = Infinity;
  for (let part = parts.pop(); part; part = parts.pop()) {
    const { surface, s, t } = part;
    const sm = (s[0] + s[1]) / 2;
    const tm = (t[0] + t[1]) / 2;
    const at = distance(surface.point(sm, tm, point));
    least = Math.min(least, at);
    if (at - surface.spread(s[0], s[1], t[0], t[1]) >= least - SURFACE_TOLERANCE) continue;
    for (const ss of [
      [s[0], sm],
      [sm, s[1]],
    ] as const) {
      for (const tt of [
        [t[0], tm],
        [tm, t[1]],
      ] as const) {
        parts.push({ surface, s: ss, t: tt });
      }
    }
  }
  return least;
}

/** An upright cylinder: its axis's x and z, its radius, and the heights of its two ends. */
export interface Cylinder {
  axis: readonly [number, number];
  radius: number;
  bottom: number;
  top: number;
}

/**
 * The least world distance from the solid `cylinder` to the item `object` poses (distanceTo), to
 * within half a millimetre. No item here can hold the whole cylinder, so it is the least distance
 * to its surface (0 where they cross): its side, by turn and height, and its two ends, by turn and
 * radius. Along an arc a point stands no further than the arc's length.
 */
export function closestToCylinder(cylinder: Cylinder, object: Object3D, measure: Measure): number {
  const { axis, radius, bottom, top } = cylinder;
  const turn = [0, 2 * Math.PI] as const;
  const side: Surface = {
    s: turn,
    t: [bottom, top],
    point: (s, t, into) =>
      into.set(axis[0] + radius * Math.cos(s), t, axis[1] + radius * Math.sin(s)),
    spread: (s0, s1, t0, t1) => Math.hypot((radius * (s1 - s0)) / 2, (t1 - t0) / 2),
  };
  const end = (y: number): Surface => ({
    s: turn,
    t: [0, radius],
    point: (s, t, into) => into.set(axis[0] + t * Math.cos(s), y, axis[1] + t * Math.sin(s)),
    spread: (s0, s1, t0, t1) => Math.hypot((t1 - t0) / 2, (t1 * (s1 - s0)) / 2),
  });
  return closestOn([side, end(bottom), end(top)], object, measure);
}
