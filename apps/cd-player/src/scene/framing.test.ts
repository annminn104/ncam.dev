import { PerspectiveCamera, Plane, Ray, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  FAR,
  FOV,
  frameDistance,
  frameFor,
  frameForViewport,
  isWide,
  nearFor,
  panKeeping,
  type CanvasPoint,
} from './framing';
import type { ModelId } from '../models';
import { BOXES, CLEAR_DOOR } from '../testing/model-measures';
import { PITCH_LIMIT, YAW_LIMIT } from './orbit';
import { SCENE_PROFILES } from './profiles';
import { clampPan, NO_PAN, ZOOM_MAX, type Pan } from './zoom';

const dist = (f: ReturnType<typeof frameFor>) =>
  Math.hypot(f.position[0] - f.target[0], f.position[1] - f.target[1], f.position[2] - f.target[2]);

// Each model's box (`BOXES`) is the whole GLB at rest with a disc in each rack slot, rounded out to
// the millimetre; the Clear's door is a second box (`DOOR`), the extent it sweeps from shut to
// open. Both were measured with three's GLTFLoader over the committed GLBs, and
// model-contract.test.ts holds the GLBs to them (src/testing/model-measures.ts).

/**
 * How much of a side the model spans at the orbit's middle, at the least: 70 % for the suitcase.
 * The Clear's floor is 60 %: under the shared orbit, perspective swings the near end of its wide,
 * low set toward the camera on a wide canvas, so its projected half-height grows about 1.6 times
 * from the orbit's middle to its ends, where 70 % at the middle and 1 % clear at the ends allow
 * only 1.4. The Deck's is 65 %: its set is wide and low like the Clear's, and its near end
 * (the deck's front left, the jewel case's front right) swings the same way; the least, at 8:7,
 * is 67 %.
 */
const FILL_FLOOR = { suitcase: 0.7, clear: 0.6, deck: 0.65 } as const;

/**
 * The hero camera of a canvas this size, turned by the orbit, magnified by the lens and panned, as
 * CameraRig makes it.
 */
function heroCamera(
  model: ModelId,
  width: number,
  height: number,
  yaw = 0,
  pitch = 0,
  zoom = 1,
  pan: Pan = NO_PAN,
): PerspectiveCamera {
  const frame = frameForViewport(width, height, yaw, pitch, model, pan);
  const camera = new PerspectiveCamera(FOV, width / height, nearFor(model), FAR);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.position.set(...frame.position);
  camera.lookAt(...frame.target);
  camera.updateMatrixWorld();
  return camera;
}

/**
 * The Clear's door (cd-player-clear.glb's `door_hinge`): its shut box, and the corners it sweeps
 * through between shut and open (0 to -100° about the hinge's Y, the profile's turn).
 */
const DOOR = { ...CLEAR_DOOR, steps: [0, -25, -50, -75, -100] } as const;

function doorCorners(): Vector3[] {
  const [hingeX, , hingeZ] = DOOR.hinge;
  const out: Vector3[] = [];
  for (const degrees of DOOR.steps) {
    const turn = (degrees * Math.PI) / 180;
    for (const x of [DOOR.min[0], DOOR.max[0]])
      for (const y of [DOOR.min[1], DOOR.max[1]])
        for (const z of [DOOR.min[2], DOOR.max[2]]) {
          const dx = x - hingeX;
          const dz = z - hingeZ;
          out.push(
            new Vector3(
              hingeX + dx * Math.cos(turn) + dz * Math.sin(turn),
              y,
              hingeZ - dx * Math.sin(turn) + dz * Math.cos(turn),
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

/**
 * How far in front of the camera, along its axis, each of the box's corners stands (metres), the
 * camera turned by the orbit and translated by the pan (the lens's zoom moves nothing).
 */
function depths(
  model: ModelId,
  width: number,
  height: number,
  yaw = 0,
  pitch = 0,
  pan: Pan = NO_PAN,
): number[] {
  const camera = heroCamera(model, width, height, yaw, pitch, 1, pan);
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

/** The pan's four extremes at 3×: (1 − 1/3) of the frame's half-size each way (zoom.ts clampPan). */
function panCorners(model: ModelId): Pan[] {
  const { frame } = SCENE_PROFILES[model];
  return [-1, 1].flatMap((x) => [-1, 1].map((y) => clampPan([x, y], ZOOM_MAX, frame)));
}

/**
 * How far beyond the near plane each model's box keeps at 3× with the pan at its extremes, across
 * the orbit (metres). The suitcase keeps the 0.2 m it keeps at 1×. The pan lies in the aim's plane,
 * square to the hero direction, and the orbit turns about the panned aim, so a turned orbit carries
 * a pan's share along the view: the Clear's worst, at 4:3, yaw −25°, pitch +10° and the pan at the
 * right and down, brings the near end of its wide set 0.13 m nearer than at 1×, and keeps 0.12 m.
 * The Deck's set is deeper (the jewel case lies 0.22 m in front of its middle): its near plane, which
 * the foil's depth steps hold at 0.82 m, leaves its worst (at 4:3, yaw −25°, pitch +10° and the pan
 * at the right and down) 0.048 m.
 */
const PAN_CLEARANCE = { suitcase: 0.2, clear: 0.12, deck: 0.04 } as const;

/** The point of the aim's plane under a canvas point: the plane every panned aim lies on. */
function aimPlanePoint(model: ModelId, camera: PerspectiveCamera, at: CanvasPoint): Vector3 {
  const { target, direction } = SCENE_PROFILES[model].frame;
  const plane = new Plane().setFromNormalAndCoplanarPoint(
    new Vector3(...direction),
    new Vector3(...target),
  );
  const toward = new Vector3(at.x, at.y, 0.5).unproject(camera).sub(camera.position).normalize();
  const point = new Ray(camera.position.clone(), toward).intersectPlane(plane, new Vector3());
  if (!point) throw new Error('the pointer’s ray misses the aim’s plane');
  return point;
}

/** Points over each face of the model's box, 5 × 5 a face. */
function boxSurface(model: ModelId): Vector3[] {
  const { min, max } = BOXES[model];
  const steps = [0, 0.25, 0.5, 0.75, 1];
  const out: Vector3[] = [];
  for (let axis = 0; axis < 3; axis++)
    for (const side of [min[axis], max[axis]])
      for (const s of steps)
        for (const t of steps) {
          const [a, b] = [0, 1, 2].filter((i) => i !== axis);
          const p = [0, 0, 0];
          p[axis] = side;
          p[a] = min[a] + (max[a] - min[a]) * s;
          p[b] = min[b] + (max[b] - min[b]) * t;
          out.push(new Vector3(p[0], p[1], p[2]));
        }
  return out;
}

describe('framing', () => {
  it('backs off as the view narrows', () => {
    expect(frameDistance(9 / 16)).toBeGreaterThan(frameDistance(16 / 9));
    expect(frameDistance(16 / 9)).toBeCloseTo(frameDistance(2), 5);
  });

  it('draws as a desktop above 820 px', () => {
    expect(isWide(820)).toBe(false);
    expect(isWide(821)).toBe(true);
  });

  for (const model of ['suitcase', 'clear', 'deck'] as const)
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
          // The pan at 3× too: at the orbit's middle it lies square to the view and moves no depth.
          for (const pan of [NO_PAN, ...panCorners(model)]) {
            const farthest = Math.max(...depths(model, width, height, 0, 0, pan));
            const steps = foilOverLabel / depthStep(farthest, nearFor(model));
            expect(steps, `${width}×${height}, pan ${pan.join(', ')}`).toBeGreaterThanOrEqual(6);
          }
        }
      });

      it('keeps its box clear of the near plane at 3×, the pan at its extremes, across the orbit', () => {
        // The lens moves no depth; the pan, carried by the camera, does once the orbit turns.
        for (const [width, height] of SHAPES)
          for (const [yaw, pitch] of TURNS)
            for (const pan of panCorners(model)) {
              const at = `${width}×${height}, yaw ${yaw.toFixed(2)}, pitch ${pitch.toFixed(2)}, pan ${pan.map((c) => c.toFixed(3)).join(', ')}`;
              const depth = depths(model, width, height, yaw, pitch, pan);
              expect(Math.min(...depth) - nearFor(model), at).toBeGreaterThan(PAN_CLEARANCE[model]);
              expect(FAR - Math.max(...depth), at).toBeGreaterThan(0.2);
            }
      });

      it('never loses the player: part of its box stays on the canvas at 3× and the pan’s extremes', () => {
        const surface = boxSurface(model);
        for (const [width, height] of SHAPES)
          for (const [yaw, pitch] of TURNS)
            for (const pan of panCorners(model)) {
              const camera = heroCamera(model, width, height, yaw, pitch, ZOOM_MAX, pan);
              const seen = surface.some((point) => {
                const p = point.clone().project(camera);
                return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && Math.abs(p.z) < 1;
              });
              const at = `${width}×${height}, yaw ${yaw.toFixed(2)}, pitch ${pitch.toFixed(2)}, pan ${pan.map((c) => c.toFixed(3)).join(', ')}`;
              expect(seen, at).toBe(true);
            }
      });
    });
});

describe('the zoom', () => {
  const MODELS = ['suitcase', 'clear'] as const;

  it('magnifies with the lens: the camera stays where 1× puts it, each point z times as far out', () => {
    for (const model of MODELS) {
      const one = heroCamera(model, 1600, 900, 0.2, -0.1);
      const two = heroCamera(model, 1600, 900, 0.2, -0.1, 2);
      expect(two.position.toArray()).toEqual(one.position.toArray());
      for (const corner of boxCorners(model)) {
        const a = corner.clone().project(one);
        const b = corner.clone().project(two);
        expect(b.x).toBeCloseTo(a.x * 2, 9);
        expect(b.y).toBeCloseTo(a.y * 2, 9);
      }
    }
  });

  it('pans the aim in its plane along the hero camera’s axes, the camera with it, whatever the turn', () => {
    for (const model of MODELS) {
      const { target: aim, direction } = SCENE_PROFILES[model].frame;
      const hero = heroCamera(model, 1600, 900);
      const right = new Vector3(1, 0, 0).applyQuaternion(hero.quaternion);
      const up = new Vector3(0, 1, 0).applyQuaternion(hero.quaternion);
      const pan: Pan = [0.05, -0.03];
      for (const [yaw, pitch] of TURNS) {
        const still = frameFor(16 / 9, yaw, pitch, model);
        const panned = frameFor(16 / 9, yaw, pitch, model, pan);
        const shift = new Vector3(...panned.target).sub(new Vector3(...aim));
        expect(shift.dot(new Vector3(...direction))).toBeCloseTo(0, 12);
        expect(shift.dot(right)).toBeCloseTo(pan[0], 12);
        expect(shift.dot(up)).toBeCloseTo(pan[1], 12);
        // The camera moves as the aim does: the orbit turns about the panned aim, as far off it.
        const moved = new Vector3(...panned.position).sub(new Vector3(...still.position));
        expect(moved.distanceTo(shift)).toBeCloseTo(0, 12);
      }
    }
  });

  it('keeps the point of the aim’s plane under the pointer where it is, the orbit turned or not', () => {
    const cases: { from: CanvasPoint; to: CanvasPoint; zoom: number; next: number; pan: Pan }[] = [
      { from: { x: 0.6, y: -0.3 }, to: { x: 0.6, y: -0.3 }, zoom: 1, next: 1.25, pan: NO_PAN },
      { from: { x: -0.8, y: 0.5 }, to: { x: -0.8, y: 0.5 }, zoom: 2, next: 1.6, pan: [0.04, 0.02] },
      // A pinch: the fingers' midpoint moves as they spread, and the point goes with it.
      { from: { x: -0.2, y: 0.1 }, to: { x: 0.1, y: 0.3 }, zoom: 2.5, next: 3, pan: [-0.08, 0.05] },
    ];
    for (const model of MODELS)
      for (const [width, height] of [
        [1600, 900],
        [390, 520],
      ])
        for (const [yaw, pitch] of TURNS)
          for (const { from, to, zoom, next, pan } of cases) {
            const before = heroCamera(model, width, height, yaw, pitch, zoom, pan);
            const point = aimPlanePoint(model, before, from);
            const kept = panKeeping(width / height, yaw, pitch, model, zoom, pan, from, to, next);
            const seen = point.project(heroCamera(model, width, height, yaw, pitch, next, kept));
            const at = `${model} ${width}×${height}, yaw ${yaw.toFixed(2)}, pitch ${pitch.toFixed(2)}, ${zoom}× to ${next}×`;
            expect(seen.x, at).toBeCloseTo(to.x, 9);
            expect(seen.y, at).toBeCloseTo(to.y, 9);
          }
  });

  it('moves the pan by the point’s share of the view × (1/zoom − 1/next), the orbit at its middle', () => {
    for (const model of MODELS) {
      const aspect = 16 / 9;
      const { across, up } = SCENE_PROFILES[model].frame;
      const halfHeight = frameDistance(aspect, FOV, across, up) * Math.tan((FOV * Math.PI) / 360);
      const at = { x: 0.5, y: -0.4 };
      const pan: Pan = [0.03, 0.01];
      const kept = panKeeping(aspect, 0, 0, model, 2, pan, at, at, 2.5);
      expect(kept[0]).toBeCloseTo(pan[0] + at.x * halfHeight * aspect * (1 / 2 - 1 / 2.5), 12);
      expect(kept[1]).toBeCloseTo(pan[1] + at.y * halfHeight * (1 / 2 - 1 / 2.5), 12);
    }
  });

  it('keeps the pan for the view’s centre, as the buttons and the keys zoom', () => {
    const pan: Pan = [0.07, -0.02];
    const centre = { x: 0, y: 0 };
    const kept = panKeeping(16 / 9, 0.3, -0.1, 'clear', 2, pan, centre, centre, 2.5);
    expect(kept[0]).toBeCloseTo(pan[0], 12);
    expect(kept[1]).toBeCloseTo(pan[1], 12);
  });
});
