import type { Vec3 } from '../math';
import { Mesh } from '../mesh';

/** x, y, z, radius, r, g, b (pre-multiplied intensity), flicker flag */
export type Light = [number, number, number, number, number, number, number, number];
/** shadow-casting spot: direction, inner/outer half-angle in degrees, radius, colour × k */
export interface Spot {
  p: Vec3;
  d: Vec3;
  inner: number;
  outer: number;
  rad: number;
  col: Vec3;
  k: number;
}
export interface DoorDef {
  z: number;
  left: number;
  right: number;
  travel: number;
  box: [number, number, number, number, number, number];
}

export interface SceneData {
  op: Mesh; // static opaque geometry
  gl: Mesh; // static glass (refraction + raindrops)
  lights: Light[];
  spots: Spot[];
  dyn: Record<string, Mesh>; // meshes drawn with a model matrix each frame (door leaves, rides, wheels)
  door: DoorDef;
}

/** builder context handed to each scene part */
export interface Ctx {
  S: SceneData;
  O: Mesh;
  G: Mesh;
  L(x: number, y: number, z: number, rad: number, col: Vec3, k?: number, flicker?: number): void;
  SPOT(p: Vec3, d: Vec3, inner: number, outer: number, rad: number, col: Vec3, k: number): void;
}

/** shop floor height */
export const SY = 0.15;
