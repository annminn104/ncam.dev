import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import sceneJson from '../../public/assets/scene.json?raw';
import { sceneSchema } from '../scene/schema';
import {
  ALIGN_CENTRE,
  alignCentre,
  EDGE_MARGIN,
  ISLAND_HALF_HEIGHTS,
  viewOffsetFor,
} from './framing';

/** Share of the width where a point straight ahead of the camera lands once the offset is applied. */
function axisAt(
  align: 'left' | 'right',
  width: number,
  height: number,
): { share: number; camera: PerspectiveCamera } {
  const camera = new PerspectiveCamera(30, width / height, 0.1, 500);
  const offset = viewOffsetFor(align, width, height)!;
  camera.setViewOffset(
    offset.fullWidth,
    offset.fullHeight,
    offset.x,
    offset.y,
    offset.width,
    offset.height,
  );
  camera.updateMatrixWorld();
  const ndc = new Vector3(0, 0, -50).project(camera);
  return { share: (ndc.x + 1) / 2, camera };
}

describe('viewOffsetFor', () => {
  it('puts the scene centre at 68 % of the width for right and 32 % for left', () => {
    expect(ALIGN_CENTRE).toEqual({ left: 0.32, center: 0.5, right: 0.68 });
    for (const [width, height] of [
      [1280, 800],
      [1512, 982],
      [2560, 1440],
    ]) {
      expect(axisAt('right', width, height).share).toBeCloseTo(0.68, 6);
      expect(axisAt('left', width, height).share).toBeCloseTo(0.32, 6);
    }
  });

  it('slides the picture without changing the perspective', () => {
    const plain = new PerspectiveCamera(30, 1.6, 0.1, 500);
    const { camera } = axisAt('right', 1280, 800);
    expect(camera.projectionMatrix.elements[0]).toBeCloseTo(plain.projectionMatrix.elements[0], 9); // horizontal zoom
    expect(camera.projectionMatrix.elements[5]).toBeCloseTo(plain.projectionMatrix.elements[5], 9); // vertical zoom
    expect(camera.fov).toBe(30);
    expect(camera.aspect).toBeCloseTo(1.6, 9);
    const ndc = new Vector3(0, 10, -50).project(camera);
    expect(ndc.y).toBeCloseTo(new Vector3(0, 10, -50).project(plain).y, 9); // vertical framing unchanged
  });

  it('needs no offset in the middle', () => {
    expect(viewOffsetFor('center', 1280, 800)).toBeNull();
  });

  it('follows the size it is given, as on a resize', () => {
    const offset = viewOffsetFor('right', 1000, 500)!;
    expect({ ...offset, x: Math.round(offset.x) }).toEqual({
      fullWidth: 1000,
      fullHeight: 500,
      x: -180,
      y: 0,
      width: 1000,
      height: 500,
    });
    expect(offset.x).toBeCloseTo(-180, 9);
    expect(viewOffsetFor('left', 1000, 500)!.x).toBeCloseTo(180, 9);
  });
});

/** Share of the width where the optical axis lands for a canvas of this size. */
const centreAt = (align: 'left' | 'right', width: number, height: number) =>
  axisAt(align, width, height).share;

describe('viewOffsetFor on narrow screens', () => {
  it('keeps the full offset on wide screens: 16:10 and wider', () => {
    for (const [w, h] of [
      [1280, 800],
      [1512, 982],
      [1920, 1080],
    ]) {
      expect(centreAt('right', w, h)).toBeCloseTo(0.68, 6);
      expect(centreAt('left', w, h)).toBeCloseTo(0.32, 6);
    }
  });

  it('moves the island towards the middle on 4:3 so its rim stays on screen', () => {
    const share = centreAt('right', 1024, 768);
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.66);
    // The rim, ISLAND_HALF_HEIGHTS / aspect of the width from the centre, keeps its margin to the edge.
    expect(share + ISLAND_HALF_HEIGHTS / (1024 / 768)).toBeCloseTo(1 - EDGE_MARGIN, 6);
    expect(centreAt('left', 1024, 768)).toBeCloseTo(1 - share, 6); // mirrored
  });

  it('centres the island on a portrait screen, where nothing is left to offset', () => {
    for (const [w, h] of [
      [390, 844],
      [768, 1024],
      [800, 800],
    ]) {
      expect(centreAt('right', w, h)).toBeLessThan(0.56);
      expect(centreAt('left', w, h)).toBeGreaterThan(0.44);
    }
    expect(centreAt('right', 390, 844)).toBeCloseTo(0.5, 6);
    expect(centreAt('left', 390, 844)).toBeCloseTo(0.5, 6);
  });

  it('shrinks the offset smoothly as the aspect ratio drops, never past the centre or the wanted share', () => {
    let previous = 0.68;
    for (let aspect = 2; aspect >= 0.4; aspect -= 0.01) {
      const share = alignCentre('right', aspect);
      expect(share).toBeLessThanOrEqual(previous + 1e-12);
      expect(previous - share).toBeLessThan(0.01);
      expect(share).toBeGreaterThanOrEqual(0.5);
      previous = share;
    }
    expect(alignCentre('center', 0.7)).toBe(0.5);
    expect(alignCentre('center', 1.6)).toBe(0.5);
  });

  it('is sized for the island CAM_idle shows: the rim reaches ISLAND_HALF_HEIGHTS of the height either side of the axis', () => {
    const scene = sceneSchema.parse(JSON.parse(sceneJson));
    const { position, rotation, fov } = scene.camera.idle;
    const camera = new PerspectiveCamera(fov, 1.6, 0.1, 500);
    camera.position.set(...position);
    camera.quaternion.set(...rotation);
    camera.updateMatrixWorld();
    const [width, depth] = scene.modules.yard.footprint;
    const tan = Math.tan((fov * Math.PI) / 360);
    let reach = 0;
    for (let k = 0; k < 256; k++) {
      const angle = (2 * Math.PI * k) / 256;
      // The squircle of exponent 4 inside the yard's footprint (zones.ISLAND), which the rim's seeded jitter only pulls in.
      const radius =
        (Math.abs(Math.cos(angle) / (width / 2)) ** 4 +
          Math.abs(Math.sin(angle) / (depth / 2)) ** 4) **
        -0.25;
      const eye = new Vector3(radius * Math.cos(angle), 0, -radius * Math.sin(angle)).applyMatrix4(
        camera.matrixWorldInverse,
      );
      reach = Math.max(reach, Math.abs(eye.x / -eye.z) / (2 * tan));
    }
    expect(ISLAND_HALF_HEIGHTS).toBeGreaterThanOrEqual(reach - 0.005);
    expect(ISLAND_HALF_HEIGHTS).toBeLessThanOrEqual(reach + 0.03);
  });
});
