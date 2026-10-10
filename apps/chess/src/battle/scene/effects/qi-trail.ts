import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import { onDispose, own } from '../dispose';
import { glideAt, trailSpan, type Glide } from '../glide';

// The qi ribbon a gliding piece draws behind it: a strip laid along the stretch of its arc the
// trail covers (glide.ts), turned to the camera, narrowing and fading to nothing at its tail.
// Written whole every frame from the glide, so it allocates nothing and never drifts.

/** Points along the ribbon, tail to head. */
export const RIBBON_POINTS = 24;
/** The ribbon's width at the piece. */
export const RIBBON_WIDTH = 0.22;
/** The ribbon runs this high above the piece's base, through the treasure's body. */
export const RIBBON_Y = 0.4;

/**
 * One piece's ribbon: `RIBBON_POINTS` pairs of vertices in `color` (a sect's qi), their alpha
 * rising from 0 at the tail to 1 at the head. Positions are writeRibbon's.
 */
export function ribbonGeometry(color: string): BufferGeometry {
  const n = RIBBON_POINTS;
  const c = new Color(color);
  const rgba = new Float32Array(n * 2 * 4);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    for (const k of [i * 2, i * 2 + 1]) rgba.set([c.r, c.g, c.b, u], k * 4);
  }
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new BufferGeometry();
  const position = new BufferAttribute(new Float32Array(n * 2 * 3), 3);
  position.setUsage(DynamicDrawUsage);
  g.setAttribute('position', position);
  g.setAttribute('color', new BufferAttribute(rgba, 4));
  g.setIndex(index);
  return g;
}

// Scratch for writeRibbon: plain maths, no GPU objects.
const centres = Array.from({ length: RIBBON_POINTS }, () => new Vector3());
const tangent = new Vector3();
const toEye = new Vector3();
const across = new Vector3();
const point = { x: 0, y: 0, z: 0 };
const span: [tail: number, head: number] = [0, 0];

/**
 * Lays `geometry` (a ribbonGeometry) along the part of `glide` its trail covers now, facing
 * `eye`. False when there is nothing to draw: the geometry is left as it was, to be hidden.
 */
export function writeRibbon(geometry: BufferGeometry, glide: Glide, eye: Vector3): boolean {
  if (!trailSpan(glide.elapsed, span)) return false;
  const tail = span[0];
  const head = span[1];
  const n = RIBBON_POINTS;
  for (let i = 0; i < n; i++) {
    glideAt(glide, tail + ((head - tail) * i) / (n - 1), point);
    centres[i].set(point.x, point.y + RIBBON_Y, point.z);
  }
  const position = geometry.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < n; i++) {
    const c = centres[i];
    tangent.subVectors(centres[Math.min(n - 1, i + 1)], centres[Math.max(0, i - 1)]);
    toEye.subVectors(eye, c);
    across.crossVectors(tangent, toEye);
    const length = across.length();
    // Narrowing to nothing at the tail; seen end-on there is no width to give it.
    const u = i / (n - 1);
    across.multiplyScalar(length > 1e-12 ? (RIBBON_WIDTH * u) / 2 / length : 0);
    position.setXYZ(i * 2, c.x + across.x, c.y + across.y, c.z + across.z);
    position.setXYZ(i * 2 + 1, c.x - across.x, c.y - across.y, c.z - across.z);
  }
  position.needsUpdate = true;
  return true;
}

let material: MeshBasicMaterial | null = null;
onDispose(() => {
  material = null;
});

/**
 * Every ribbon's material: unlit, its colour and alpha from the vertices. Normal blending, not
 * additive: added to Cloud Peak's white jade or Lotus Lake's pale stone, a sect's qi would turn
 * white and vanish.
 */
export function ribbonMaterial(): MeshBasicMaterial {
  material ??= own(
    new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    }),
  );
  return material;
}
