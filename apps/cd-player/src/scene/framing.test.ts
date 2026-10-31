import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { FOV, frameDistance, frameFor, frameForViewport, isWide } from './framing';
import { PITCH_LIMIT, YAW_LIMIT } from './orbit';

const dist = (f: ReturnType<typeof frameFor>) =>
  Math.hypot(f.position[0] - f.target[0], f.position[1] - f.target[1], f.position[2] - f.target[2]);

// cd-player.glb's bounding box in three's Y-up metres: the player alone, lid open, centred at x = 0.
const BOX = { min: [-0.152, -0.003, -0.199], max: [0.152, 0.319, 0.152] } as const;

/**
 * The box's eight corners in normalised device coordinates (±1 is the canvas's edge), seen from
 * the hero camera of a canvas this size, turned by the orbit. The corners are the worst case: the
 * player's own silhouette is smaller than its box.
 */
function corners(width: number, height: number, yaw = 0, pitch = 0): Vector3[] {
  const frame = frameForViewport(width, height, yaw, pitch);
  const camera = new PerspectiveCamera(FOV, width / height, 0.02, 10);
  camera.position.set(...frame.position);
  camera.lookAt(...frame.target);
  camera.updateMatrixWorld();
  const out: Vector3[] = [];
  for (const x of [BOX.min[0], BOX.max[0]])
    for (const y of [BOX.min[1], BOX.max[1]])
      for (const z of [BOX.min[2], BOX.max[2]]) out.push(new Vector3(x, y, z).project(camera));
  return out;
}

/** Every canvas shape the stage can take, from a tall one (0.43) to a wide, short one (2.63). */
const SHAPES = Array.from({ length: 23 }, (_, i) => [Math.round((0.43 + i * 0.1) * 800), 800]);

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

  it('aims at the same point of the player on every canvas, so it stands in the middle', () => {
    for (const [width, height] of SHAPES) {
      expect(frameForViewport(width, height).target).toEqual(frameFor(1).target);
      const c = corners(width, height);
      const middle = (axis: 'x' | 'y') =>
        (Math.max(...c.map((p) => p[axis])) + Math.min(...c.map((p) => p[axis]))) / 2;
      expect(Math.abs(middle('x')), `${width}×${height}, across`).toBeLessThanOrEqual(0.05);
      expect(Math.abs(middle('y')), `${width}×${height}, down`).toBeLessThanOrEqual(0.05);
    }
  });

  it('orbits at a constant distance, pitch raising the eye', () => {
    const base = frameFor(16 / 9);
    const turned = frameFor(16 / 9, 0.3, 0.1);
    expect(dist(turned)).toBeCloseTo(dist(base), 6);
    expect(turned.position[1]).toBeGreaterThan(base.position[1]);
  });

  it('is wide once the tracklist is a drawer beside the player, above 820 px', () => {
    expect(isWide(820)).toBe(false);
    expect(isWide(821)).toBe(true);
  });

  it('keeps the whole player in its canvas, 2 % clear of every edge, across the orbit', () => {
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

  it('fills its canvas: the player spans 70 % or more of its tighter side', () => {
    for (const [width, height] of SHAPES) {
      const c = corners(width, height);
      const half = (axis: 'x' | 'y') =>
        (Math.max(...c.map((p) => p[axis])) - Math.min(...c.map((p) => p[axis]))) / 2;
      expect(Math.max(half('x'), half('y')), `${width}×${height}`).toBeGreaterThanOrEqual(0.7);
    }
  });
});
