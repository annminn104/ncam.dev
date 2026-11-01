import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { FAR, FOV, NEAR, frameDistance, frameFor, frameForViewport, isWide } from './framing';
import { PITCH_LIMIT, YAW_LIMIT } from './orbit';

const dist = (f: ReturnType<typeof frameFor>) =>
  Math.hypot(f.position[0] - f.target[0], f.position[1] - f.target[1], f.position[2] - f.target[2]);

// cd-player.glb's bounding box in three's Y-up metres: the player alone, lid open, centred at x = 0.
const BOX = { min: [-0.152, -0.003, -0.199], max: [0.152, 0.319, 0.152] } as const;

/** The hero camera of a canvas this size, turned by the orbit, as PlayerScene makes it. */
function heroCamera(width: number, height: number, yaw = 0, pitch = 0): PerspectiveCamera {
  const frame = frameForViewport(width, height, yaw, pitch);
  const camera = new PerspectiveCamera(FOV, width / height, NEAR, FAR);
  camera.position.set(...frame.position);
  camera.lookAt(...frame.target);
  camera.updateMatrixWorld();
  return camera;
}

function boxCorners(): Vector3[] {
  const out: Vector3[] = [];
  for (const x of [BOX.min[0], BOX.max[0]])
    for (const y of [BOX.min[1], BOX.max[1]])
      for (const z of [BOX.min[2], BOX.max[2]]) out.push(new Vector3(x, y, z));
  return out;
}

/**
 * The box's eight corners in normalised device coordinates (±1 is the canvas's edge), seen from
 * the hero camera of a canvas this size, turned by the orbit. The corners are the worst case: the
 * player's own silhouette is smaller than its box.
 */
function corners(width: number, height: number, yaw = 0, pitch = 0): Vector3[] {
  const camera = heroCamera(width, height, yaw, pitch);
  return boxCorners().map((corner) => corner.project(camera));
}

/** How far in front of the camera, along its axis, each of the box's corners stands (metres). */
function depths(width: number, height: number, yaw = 0, pitch = 0): number[] {
  const camera = heroCamera(width, height, yaw, pitch);
  return boxCorners().map((corner) => -corner.applyMatrix4(camera.matrixWorldInverse).z);
}

/** The step of a 24-bit depth buffer `depth` metres in front of the camera: far(z − near) / z(far − near). */
function depthStep(depth: number): number {
  return (depth * depth * (FAR - NEAR)) / (FAR * NEAR * 2 ** 24);
}

/**
 * Canvas shapes, as wide for their height: from 0.2 to 7, past every stage the layouts make (a
 * phone's 220 px floor reaches about 3.6, a tall window's rail about 0.26), in steps from 0.43 to
 * 2.63, where most of them fall.
 */
const ASPECTS = [0.2, 0.3, ...Array.from({ length: 23 }, (_, i) => 0.43 + i * 0.1), 3.5, 5, 7];
const SHAPES = ASPECTS.map((aspect) => [Math.round(aspect * 800), 800]);

/** The orbit's corners and its middle: yaw ±25°, pitch ±10°. */
const TURNS = [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((p) => [y * YAW_LIMIT, p * PITCH_LIMIT]));

describe('framing', () => {
  it('backs off as the view narrows', () => {
    expect(frameDistance(9 / 16)).toBeGreaterThan(frameDistance(16 / 9));
    expect(frameDistance(16 / 9)).toBeCloseTo(frameDistance(2), 5);
  });

  it('looks from the hero still: front left, above', () => {
    const f = frameFor(16 / 9);
    expect(f.position[0]).toBeLessThan(f.target[0]);
    expect(f.position[1]).toBeGreaterThan(f.target[1]);
    expect(f.position[2]).toBeGreaterThan(f.target[2]);
  });

  // NDC run from -1 to 1, so 0.06 off the middle is 3 % of the canvas, and 0.98 is 1 % from an edge.
  it('aims at the same point of the player on every canvas, so it stands in the middle', () => {
    for (const [width, height] of SHAPES) {
      expect(frameForViewport(width, height).target).toEqual(frameFor(1).target);
      const c = corners(width, height);
      const middle = (axis: 'x' | 'y') =>
        (Math.max(...c.map((p) => p[axis])) + Math.min(...c.map((p) => p[axis]))) / 2;
      expect(Math.abs(middle('x')), `${width}×${height}, across`).toBeLessThanOrEqual(0.06);
      expect(Math.abs(middle('y')), `${width}×${height}, down`).toBeLessThanOrEqual(0.06);
    }
  });

  it('orbits at a constant distance, pitch raising the eye', () => {
    const base = frameFor(16 / 9);
    const turned = frameFor(16 / 9, 0.3, 0.1);
    expect(dist(turned)).toBeCloseTo(dist(base), 6);
    expect(turned.position[1]).toBeGreaterThan(base.position[1]);
  });

  it('draws as a desktop above 820 px', () => {
    expect(isWide(820)).toBe(false);
    expect(isWide(821)).toBe(true);
  });

  it('keeps the whole player in its canvas, 1 % clear of every edge, across the orbit', () => {
    for (const [width, height] of SHAPES) {
      for (const [yaw, pitch] of TURNS) {
        const at = `${width}×${height}, yaw ${yaw.toFixed(2)}, pitch ${pitch.toFixed(2)}`;
        for (const corner of corners(width, height, yaw, pitch)) {
          expect(Math.abs(corner.x), at).toBeLessThanOrEqual(0.98);
          expect(Math.abs(corner.y), at).toBeLessThanOrEqual(0.98);
        }
      }
    }
  });

  it('fills its canvas at the orbit’s middle: the player spans 70 % or more of a side', () => {
    for (const [width, height] of SHAPES) {
      const c = corners(width, height);
      const half = (axis: 'x' | 'y') =>
        (Math.max(...c.map((p) => p[axis])) - Math.min(...c.map((p) => p[axis]))) / 2;
      expect(Math.max(half('x'), half('y')), `${width}×${height}`).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('holds the player between the near and far planes, with room for what flies off it', () => {
    for (const [width, height] of SHAPES) {
      for (const [yaw, pitch] of TURNS) {
        const at = `${width}×${height}, yaw ${yaw.toFixed(2)}, pitch ${pitch.toFixed(2)}`;
        const depth = depths(width, height, yaw, pitch);
        // 0.2 m to spare: a disc flying to or from the side, the case turning over.
        expect(Math.min(...depth) - NEAR, at).toBeGreaterThan(0.2);
        expect(FAR - Math.max(...depth), at).toBeGreaterThan(0.2);
      }
    }
  });

  // The disc (make_disc in art/blender/scripts/parts.py) lays its label 20 µm over its clear
  // body's top and the foil rings 5 µm over the label, as a Cycles render wants them. The depth
  // buffer must tell them apart at the player, or they fight and every disc's rim and hub ring
  // comes out ragged: with the near plane at 0.02 m its step at the player was about 4 µm.
  it('resolves the foil 5 µm over the disc’s label in six depth steps or more', () => {
    const foilOverLabel = 5e-6;
    // Canvases half as wide as tall and wider: every stage but a portrait monitor's rail (down to
    // about 0.26), whose camera stands 2.5 to 4 m back, the foil two or three steps over the
    // label there; the page drew it clean at 1440 × 2560 all the same.
    for (const [width, height] of SHAPES.filter(([w, h]) => w / h >= 0.5)) {
      const farthest = Math.max(...depths(width, height));
      const steps = foilOverLabel / depthStep(farthest);
      expect(steps, `${width}×${height}`).toBeGreaterThanOrEqual(6);
    }
  });
});
