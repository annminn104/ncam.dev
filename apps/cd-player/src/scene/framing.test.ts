import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { FOV, frameDistance, frameFor } from './framing';

const dist = (f: ReturnType<typeof frameFor>) =>
  Math.hypot(f.position[0] - f.target[0], f.position[1] - f.target[1], f.position[2] - f.target[2]);

// cd-player.glb's bounding box in three's Y-up metres: the player alone, lid open, centred at x = 0.
const BOX = { min: [-0.151, -0.003, -0.198], max: [0.151, 0.318, 0.126] } as const;

/**
 * The box's eight corners in normalised device coordinates (±1 is the viewport's edge), seen from
 * the hero camera. The corners are the worst case: the player's own silhouette keeps about 3% of
 * the height to spare at the bottom.
 */
function corners(width: number, height: number, wide: boolean): Vector3[] {
  const aspect = width / height;
  const frame = frameFor(aspect, wide);
  const camera = new PerspectiveCamera(FOV, aspect, 0.02, 10);
  camera.position.set(...frame.position);
  camera.lookAt(...frame.target);
  camera.updateMatrixWorld();
  const out: Vector3[] = [];
  for (const x of [BOX.min[0], BOX.max[0]])
    for (const y of [BOX.min[1], BOX.max[1]])
      for (const z of [BOX.min[2], BOX.max[2]]) out.push(new Vector3(x, y, z).project(camera));
  return out;
}

describe('framing', () => {
  it('backs off as the view narrows', () => {
    expect(frameDistance(9 / 16)).toBeGreaterThan(frameDistance(16 / 9));
    expect(frameDistance(16 / 9)).toBeCloseTo(frameDistance(2), 5);
  });

  it('looks from the hero still: front left, above', () => {
    const f = frameFor(16 / 9, true);
    expect(f.position[0]).toBeLessThan(f.target[0]);
    expect(f.position[1]).toBeGreaterThan(f.target[1]);
    expect(f.position[2]).toBeGreaterThan(f.target[2]);
  });

  it('moves the target right on wide screens, so the player sits clear of the drawer', () => {
    expect(frameFor(16 / 9, true).target[0]).toBeGreaterThan(frameFor(16 / 9, false).target[0]);
  });

  it('orbits at a constant distance, pitch raising the eye', () => {
    const base = frameFor(16 / 9, true);
    const turned = frameFor(16 / 9, true, 0.3, 0.1);
    expect(dist(turned)).toBeCloseTo(dist(base), 6);
    expect(turned.position[1]).toBeGreaterThan(base.position[1]);
  });

  // `bar` is where the glass link bar ends, as a fraction of the viewport's height (measured in
  // the browser); the player's top must stay below it.
  it.each([
    { name: '16:9 (1920×1080)', width: 1920, height: 1080, wide: true, bar: 0.093 },
    { name: '16:10 (1440×900)', width: 1440, height: 900, wide: true, bar: 0.134 },
    // The bar stacks on a screen this narrow and ends at 21%, so it covers the lid's top rim:
    // only the viewport is held here.
    { name: '4:3 (1024×768)', width: 1024, height: 768, wide: true, bar: 0 },
    { name: 'a phone (390×844)', width: 390, height: 844, wide: false, bar: 0.175 },
  ])('shows the whole player on $name', ({ width, height, wide, bar }) => {
    for (const corner of corners(width, height, wide)) {
      expect(Math.abs(corner.x)).toBeLessThanOrEqual(1);
      expect(corner.y).toBeGreaterThanOrEqual(-1);
      expect(corner.y).toBeLessThanOrEqual(1 - 2 * bar);
    }
  });
});
