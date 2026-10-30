import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { FOV, frameDistance, frameFor, frameForViewport, isWide } from './framing';

const dist = (f: ReturnType<typeof frameFor>) =>
  Math.hypot(f.position[0] - f.target[0], f.position[1] - f.target[1], f.position[2] - f.target[2]);

// cd-player.glb's bounding box in three's Y-up metres: the player alone, lid open, centred at x = 0.
const BOX = { min: [-0.152, -0.003, -0.199], max: [0.152, 0.319, 0.152] } as const;

// Where the glass link bar ends, in CSS px from the top (src/styles/app.css), measured in the
// browser with the collection loaded: one row above 1260 px wide; stacked from 821 to 1260, where
// its title grows with the width (160 px at 821, 163 at 1024, 169 at 1260); and on a phone.
const ROW_BAR_PX = 121;
const STACKED_BAR_MAX_PX = 169;
const PHONE_BAR_PX = 148;

/**
 * The box's eight corners in normalised device coordinates (±1 is the viewport's edge), seen from
 * the hero camera of a canvas this size. The corners are the worst case: the player's own
 * silhouette keeps about 3% of the height to spare at the bottom.
 */
function corners(width: number, height: number): Vector3[] {
  const aspect = width / height;
  const frame = frameForViewport(width, height);
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

  it('is wide once the tracklist is a drawer beside the player, above 820 px', () => {
    expect(isWide(820)).toBe(false);
    expect(isWide(821)).toBe(true);
  });

  // `bar` is where the link bar ends, in px: the player's top must stay below it.
  it.each([
    { name: '16:9 (1920×1080)', width: 1920, height: 1080, bar: ROW_BAR_PX },
    { name: '16:10 (1440×900)', width: 1440, height: 900, bar: ROW_BAR_PX },
    { name: '4:3 (1024×768), the bar stacked', width: 1024, height: 768, bar: 163 },
    { name: '960×1080, narrower than tall', width: 960, height: 1080, bar: 161 },
    { name: '834×1194, a tablet upright', width: 834, height: 1194, bar: 160 },
    { name: '1024×1366, a large tablet upright', width: 1024, height: 1366, bar: 163 },
    { name: '1000×900, nearly square', width: 1000, height: 900, bar: 162 },
    { name: '1100×1000, nearly square', width: 1100, height: 1000, bar: 165 },
    { name: 'a phone (390×844)', width: 390, height: 844, bar: PHONE_BAR_PX },
  ])('shows the whole player, clear of the link bar, on $name', ({ width, height, bar }) => {
    for (const corner of corners(width, height)) {
      expect(Math.abs(corner.x)).toBeLessThanOrEqual(1);
      expect(corner.y).toBeGreaterThanOrEqual(-1);
      expect(corner.y).toBeLessThanOrEqual(1 - (2 * bar) / height);
    }
  });

  it('keeps the whole player in view on every screen shape the layout has', () => {
    const widths = [
      360, 390, 820, 821, 834, 960, 1000, 1024, 1100, 1260, 1261, 1366, 1440, 1920, 2560,
    ];
    for (const width of widths) {
      for (const height of [600, 768, 900, 1080, 1366]) {
        // Where the link bar stacks, the player also stays clear of it.
        const stacked = width > 820 && width <= 1260;
        const top = stacked ? 1 - (2 * STACKED_BAR_MAX_PX) / height : 1;
        for (const corner of corners(width, height)) {
          expect(Math.abs(corner.x), `${width}×${height}, across`).toBeLessThanOrEqual(1);
          expect(corner.y, `${width}×${height}, bottom`).toBeGreaterThanOrEqual(-1);
          expect(corner.y, `${width}×${height}, top`).toBeLessThanOrEqual(top);
        }
      }
    }
  });
});
