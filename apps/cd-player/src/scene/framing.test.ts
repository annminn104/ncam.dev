import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { FAR, FOV, frameDistance, frameFor, frameForViewport, isWide, nearFor } from './framing';
import type { ModelId } from '../models';
import { PITCH_LIMIT, YAW_LIMIT } from './orbit';

const dist = (f: ReturnType<typeof frameFor>) =>
  Math.hypot(f.position[0] - f.target[0], f.position[1] - f.target[1], f.position[2] - f.target[2]);

/**
 * Each model's bounding box in three's Y-up metres. The suitcase's (cd-player.glb) is the player
 * alone, lid open, centred at x = 0. The Clear model's (cd-player-clear.glb) is the whole GLB at
 * rest (the player, its plinth, handle and knob, the stand, the jewel case and its easel) with a
 * 120 mm disc in each of the five rack slots, which the page puts there; the discs lie within the
 * stand's own extent. The Clear's door is a second box (`DOOR`), the extent it sweeps from shut to open.
 */
const BOXES = {
  suitcase: { min: [-0.152, -0.003, -0.199], max: [0.152, 0.319, 0.152] },
  clear: { min: [-0.316, -0.001, -0.09], max: [0.333, 0.279, 0.069] },
} as const;

/**
 * How much of a side the model spans at the orbit's middle, at the least: 70 % for the suitcase.
 * The Clear's floor is 60 %: under the shared orbit, perspective swings the near end of its wide,
 * low set toward the camera on a wide canvas, so its projected half-height grows about 1.6 times
 * from the orbit's middle to its ends, where 70 % at the middle and 1 % clear at the ends allow
 * only 1.4.
 */
const FILL_FLOOR = { suitcase: 0.7, clear: 0.6 } as const;

/** The hero camera of a canvas this size, turned by the orbit, as PlayerScene makes it. */
function heroCamera(
  model: ModelId,
  width: number,
  height: number,
  yaw = 0,
  pitch = 0,
): PerspectiveCamera {
  const frame = frameForViewport(width, height, yaw, pitch, model);
  const camera = new PerspectiveCamera(FOV, width / height, nearFor(model), FAR);
  camera.position.set(...frame.position);
  camera.lookAt(...frame.target);
  camera.updateMatrixWorld();
  return camera;
}

/**
 * The Clear's door (cd-player-clear.glb's `door_hinge`, at (-0.079, 0.1501, 0.0405)): its shut
 * box, and the corners it sweeps through between shut and open (0 to -100° about the hinge's Y).
 */
const DOOR = {
  hinge: [-0.079, 0.0405],
  min: [-0.082, 0.0751, 0.0375],
  max: [0.0798, 0.2251, 0.0435],
  steps: [0, -25, -50, -75, -100],
} as const;

function doorCorners(): Vector3[] {
  const out: Vector3[] = [];
  for (const degrees of DOOR.steps) {
    const turn = (degrees * Math.PI) / 180;
    for (const x of [DOOR.min[0], DOOR.max[0]])
      for (const y of [DOOR.min[1], DOOR.max[1]])
        for (const z of [DOOR.min[2], DOOR.max[2]]) {
          const dx = x - DOOR.hinge[0];
          const dz = z - DOOR.hinge[1];
          out.push(
            new Vector3(
              DOOR.hinge[0] + dx * Math.cos(turn) + dz * Math.sin(turn),
              y,
              DOOR.hinge[1] - dx * Math.sin(turn) + dz * Math.cos(turn),
            ),
          );
        }
  }
  return out;
}

/** The model's box's corners, and for the Clear the door's swept extent too. */
function boxCorners(model: ModelId): Vector3[] {
  const BOX = BOXES[model];
  const out: Vector3[] = model === 'clear' ? doorCorners() : [];
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
function corners(model: ModelId, width: number, height: number, yaw = 0, pitch = 0): Vector3[] {
  const camera = heroCamera(model, width, height, yaw, pitch);
  return boxCorners(model).map((corner) => corner.project(camera));
}

/** How far in front of the camera, along its axis, each of the box's corners stands (metres). */
function depths(model: ModelId, width: number, height: number, yaw = 0, pitch = 0): number[] {
  const camera = heroCamera(model, width, height, yaw, pitch);
  return boxCorners(model).map((corner) => -corner.applyMatrix4(camera.matrixWorldInverse).z);
}

/** The step of a 24-bit depth buffer `depth` metres in front of the camera: far(z − near) / z(far − near). */
function depthStep(depth: number, near: number): number {
  return (depth * depth * (FAR - near)) / (FAR * near * 2 ** 24);
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

  it('draws as a desktop above 820 px', () => {
    expect(isWide(820)).toBe(false);
    expect(isWide(821)).toBe(true);
  });

  for (const model of ['suitcase', 'clear'] as const)
    describe(model, () => {
      it('looks from the hero still: front left, above', () => {
        const f = frameFor(16 / 9, 0, 0, model);
        expect(f.position[0]).toBeLessThan(f.target[0]);
        expect(f.position[1]).toBeGreaterThan(f.target[1]);
        expect(f.position[2]).toBeGreaterThan(f.target[2]);
      });

      // NDC run from -1 to 1, so 0.06 off the middle is 3 % of the canvas, and 0.98 is 1 % from an edge.
      it('aims at the same point of the player on every canvas, so it stands in the middle', () => {
        for (const [width, height] of SHAPES) {
          expect(frameForViewport(width, height, 0, 0, model).target).toEqual(
            frameFor(1, 0, 0, model).target,
          );
          const c = corners(model, width, height);
          const middle = (axis: 'x' | 'y') =>
            (Math.max(...c.map((p) => p[axis])) + Math.min(...c.map((p) => p[axis]))) / 2;
          expect(Math.abs(middle('x')), `${width}×${height}, across`).toBeLessThanOrEqual(0.06);
          expect(Math.abs(middle('y')), `${width}×${height}, down`).toBeLessThanOrEqual(0.06);
        }
      });

      it('orbits at a constant distance, pitch raising the eye', () => {
        const base = frameFor(16 / 9, 0, 0, model);
        const turned = frameFor(16 / 9, 0.3, 0.1, model);
        expect(dist(turned)).toBeCloseTo(dist(base), 6);
        expect(turned.position[1]).toBeGreaterThan(base.position[1]);
      });

      it('keeps the whole player in its canvas, 1 % clear of every edge, across the orbit', () => {
        for (const [width, height] of SHAPES) {
          for (const [yaw, pitch] of TURNS) {
            const at = `${width}×${height}, yaw ${yaw.toFixed(2)}, pitch ${pitch.toFixed(2)}`;
            for (const corner of corners(model, width, height, yaw, pitch)) {
              expect(Math.abs(corner.x), at).toBeLessThanOrEqual(0.98);
              expect(Math.abs(corner.y), at).toBeLessThanOrEqual(0.98);
            }
          }
        }
      });

      it('fills its canvas at the orbit’s middle: the player spans its floor or more of a side', () => {
        for (const [width, height] of SHAPES) {
          const c = corners(model, width, height);
          const half = (axis: 'x' | 'y') =>
            (Math.max(...c.map((p) => p[axis])) - Math.min(...c.map((p) => p[axis]))) / 2;
          expect(Math.max(half('x'), half('y')), `${width}×${height}`).toBeGreaterThanOrEqual(
            FILL_FLOOR[model],
          );
        }
      });

      it('holds the player between the near and far planes, with room for what flies off it', () => {
        for (const [width, height] of SHAPES) {
          for (const [yaw, pitch] of TURNS) {
            const at = `${width}×${height}, yaw ${yaw.toFixed(2)}, pitch ${pitch.toFixed(2)}`;
            const depth = depths(model, width, height, yaw, pitch);
            // 0.2 m to spare: a disc flying to or from the side, the case turning over.
            expect(Math.min(...depth) - nearFor(model), at).toBeGreaterThan(0.2);
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
          const farthest = Math.max(...depths(model, width, height));
          const steps = foilOverLabel / depthStep(farthest, nearFor(model));
          expect(steps, `${width}×${height}`).toBeGreaterThanOrEqual(6);
        }
      });
    });
});
