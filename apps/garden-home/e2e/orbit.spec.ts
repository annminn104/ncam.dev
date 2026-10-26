import { expect, type Page, test } from '@playwright/test';
import { HOUSE_TOP } from '../src/camera/orbit';
import {
  camera,
  type CameraState,
  collectErrors,
  frames,
  gotoSite,
  meanDifference,
  pick,
  project,
  settle,
  waitForScene,
  zoomTo,
} from './helpers';

/** Damping eases the camera over the following frames; SwiftShader renders only a few per second. */
const SETTLE_MS = 2500;

async function zoomIn(page: Page): Promise<void> {
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -800);
  await page.waitForTimeout(SETTLE_MS);
}

async function drag(page: Page): Promise<void> {
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(900, 380, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(SETTLE_MS);
}

test('the site route zooms with the wheel and orbits with a drag', async ({ page }) => {
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  const canvas = page.locator('canvas');
  const before = await canvas.screenshot();
  await zoomIn(page);
  const zoomed = await canvas.screenshot();
  expect(meanDifference(before, zoomed)).toBeGreaterThan(8);
  await drag(page);
  const turned = await canvas.screenshot();
  expect(meanDifference(zoomed, turned)).toBeGreaterThan(8);
  expect(errors).toEqual([]);
});

test('the wallpaper ignores the mouse', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/wallpaper?t=12:00');
  await waitForScene(page);
  const canvas = page.locator('canvas');
  // The idle drift and the water move the frame a little on their own: measure that over the same time first.
  const start = await canvas.screenshot();
  await page.waitForTimeout(2 * SETTLE_MS);
  const before = await canvas.screenshot();
  const drift = meanDifference(start, before);
  await zoomIn(page);
  await drag(page);
  expect(meanDifference(before, await canvas.screenshot())).toBeLessThan(drift + 2);
  expect(errors).toEqual([]);
});

/** Looks down from about 50 degrees, so no clearance holds the camera while it zooms or turns from there. */
async function lookDown(page: Page): Promise<void> {
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(640, 455, { steps: 8 });
  await page.mouse.up();
  await settle(page);
}

/** How far (client pixels) from (x, y) a world point shows now. */
async function offScreenBy(
  page: Page,
  point: readonly number[],
  x: number,
  y: number,
): Promise<number> {
  const now = await project(page, point);
  expect(now, 'the point on screen').not.toBeNull();
  return Math.hypot(now!.x - x, now!.y - y);
}

test('a wheel zoom keeps the point under the cursor under it, zooming in and out', async ({
  page,
}) => {
  test.setTimeout(240_000); // a look down and four zooms, each settled: 2.1 min under load 20 with the carport's louvres
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  await lookDown(page);
  // the lawn west of the pond, off the middle of the view, and the house's roof
  for (const spot of [
    [-4, 0, 14],
    [6, 7.6, -11],
  ]) {
    const screen = await project(page, spot);
    expect(screen, `(${spot}) on screen`).not.toBeNull();
    const { x, y } = screen!;
    const point = await pick(page, x, y);
    expect(point, `the scene under (${x}, ${y})`).not.toBeNull();
    await page.mouse.move(x, y);
    const { target } = await camera(page);
    for (const delta of [-600, 600]) {
      await page.mouse.wheel(0, delta);
      await settle(page);
      expect(
        await offScreenBy(page, point!, x, y),
        `zoomed ${delta < 0 ? 'in' : 'out'} at (${x}, ${y})`,
      ).toBeLessThan(3);
      if (delta < 0)
        expect(
          Math.hypot(...(await camera(page)).target.map((v, k) => v - target[k])),
        ).toBeGreaterThan(1); // the target came along
    }
  }
  expect(errors).toEqual([]);
});

/** The lawn west of the pond, off the middle of the view: where it shows and the point of the scene under it. */
async function lawnSpot(
  page: Page,
): Promise<{ x: number; y: number; point: [number, number, number] }> {
  const screen = await project(page, [-4, 0, 14]);
  expect(screen, 'the lawn on screen').not.toBeNull();
  const point = await pick(page, screen!.x, screen!.y);
  expect(point, 'the scene under the lawn spot').not.toBeNull();
  return { ...screen!, point: point! };
}

/** After a zoom in (`inwards`) or out from `before`: the distance went that way, and the target came along going in. */
async function zoomedFrom(page: Page, before: CameraState, inwards: boolean): Promise<void> {
  const after = await camera(page);
  if (inwards) {
    expect(after.distance).toBeLessThan(0.9 * before.distance);
    expect(
      Math.hypot(...after.target.map((v, k) => v - before.target[k])),
      'the target came along',
    ).toBeGreaterThan(1);
  } else {
    expect(after.distance).toBeGreaterThan(1.1 * before.distance);
  }
  expect(after.target[1]).toBeCloseTo(0, 6);
}

test('a trackpad pinch (the wheel with ctrl held) zooms towards the point under the cursor too', async ({
  page,
}) => {
  test.setTimeout(240_000); // a look down and two gestures, each settled: past 150 s at a load average of 40
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  await lookDown(page);
  const { x, y, point } = await lawnSpot(page);
  await page.mouse.move(x, y);
  // the browser sends a trackpad pinch as wheel events with ctrlKey set; OrbitControls takes them as a zoom (and keeps the
  // page from zooming), the rig moves it towards the point under the cursor
  await page.keyboard.down('Control');
  for (const delta of [-300, 300]) {
    const before = await camera(page);
    await page.mouse.wheel(0, delta);
    await settle(page);
    expect(
      await offScreenBy(page, point, x, y),
      `pinched ${delta < 0 ? 'out (in)' : 'in (out)'} at (${x}, ${y})`,
    ).toBeLessThan(3);
    await zoomedFrom(page, before, delta < 0);
  }
  await page.keyboard.up('Control');
  expect(errors).toEqual([]);
});

test('a middle-button drag zooms towards the point under where it started', async ({ page }) => {
  test.setTimeout(240_000); // a look down and two gestures, each settled: past 150 s at a load average of 40
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  await lookDown(page);
  const { x, y, point } = await lawnSpot(page);
  for (const dy of [-300, 300]) {
    // up dollies in, down out
    const before = await camera(page);
    await page.mouse.move(x, y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(x, y + dy, { steps: 10 });
    await page.mouse.up({ button: 'middle' });
    await settle(page);
    expect(
      await offScreenBy(page, point, x, y),
      `dragged ${dy < 0 ? 'up' : 'down'} from (${x}, ${y})`,
    ).toBeLessThan(3);
    await zoomedFrom(page, before, dy < 0);
  }
  expect(errors).toEqual([]);
});

test('a touch pinch zooms towards the point between the fingers', async ({ page }) => {
  test.setTimeout(240_000); // a look down and two gestures, each settled: past 150 s at a load average of 40
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  await lookDown(page);
  const { x, y, point } = await lawnSpot(page);
  // two fingers either side of the spot, spreading or closing in eight steps (CDP touch events become touch pointers)
  const cdp = await page.context().newCDPSession(page);
  const fingers = (half: number) => [
    { x: x - half, y, id: 1 },
    { x: x + half, y, id: 2 },
  ];
  for (const [from, to] of [
    [40, 80],
    [80, 40],
  ]) {
    const before = await camera(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(from) });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: fingers(from + ((to - from) * i) / 8),
      });
      await frames(page, 2);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settle(page);
    // each finger's move is its own pointer event: the middle the rig sees is half a step to one side, then back
    expect(
      await offScreenBy(page, point, x, y),
      `${to > from ? 'spread' : 'closed'} round (${x}, ${y})`,
    ).toBeLessThan(6);
    await zoomedFrom(page, before, to > from);
    expect((await camera(page)).pivot, 'a pinch turns nothing').toBeNull();
  }
  expect(errors).toEqual([]);
});

test('a drag that starts on the pond turns round it; one that starts on the sky turns round the target', async ({
  page,
}) => {
  test.setTimeout(240_000); // two drags and a look down, each settled: past 150 s at a load average of 40
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  // over the sky at the top of the first view: round the target, which stays where it is
  expect(await pick(page, 640, 30), 'sky at the top').toBeNull();
  const before = await camera(page);
  await page.mouse.move(640, 30);
  await page.mouse.down();
  await page.mouse.move(760, 30, { steps: 10 });
  expect((await camera(page)).pivot).toBeNull();
  await page.mouse.up();
  await settle(page);
  let after = await camera(page);
  expect(Math.hypot(...after.target.map((v, k) => v - before.target[k]))).toBeLessThan(1e-3);
  expect(Math.hypot(...after.position.map((v, k) => v - before.position[k]))).toBeGreaterThan(5);

  // on the pond's water: round it, which keeps its place on screen while the camera swings round it
  await lookDown(page);
  const pond = await project(page, [9, -0.1, 11]);
  expect(pond, 'the pond on screen').not.toBeNull();
  const point = await pick(page, pond!.x, pond!.y);
  expect(point, 'the pond under the cursor').not.toBeNull();
  const start = await camera(page);
  await page.mouse.move(pond!.x, pond!.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(pond!.x + 12 * i, pond!.y);
    await frames(page, 2);
    expect(await offScreenBy(page, point!, pond!.x, pond!.y), `step ${i}`).toBeLessThan(6);
  }
  const { pivot } = await camera(page);
  expect(Math.hypot(...pivot!.map((v, k) => v - point![k]))).toBeLessThan(1e-3);
  await page.mouse.up();
  await settle(page);
  after = await camera(page);
  expect(await offScreenBy(page, point!, pond!.x, pond!.y)).toBeLessThan(6);
  // the target swung round the pond with the camera, on the ground
  expect(Math.hypot(...after.target.map((v, k) => v - start.target[k]))).toBeGreaterThan(2);
  expect(after.target[1]).toBeCloseTo(0, 6);
  expect(errors).toEqual([]);
});

/** The rim of the island's grass top less the 3 m the target keeps inside it (orbit.ts ISLAND_RIM, clampTarget). */
function insideIsland([x, , z]: readonly number[]): boolean {
  const angle = Math.atan2(z, x);
  const rim =
    ((Math.abs(Math.cos(angle)) / 27) ** 4 + (Math.abs(Math.sin(angle)) / 23) ** 4) ** -0.25 *
    0.985;
  return Math.hypot(x, z) <= rim - 3 + 0.01;
}

test('zooming towards the rim keeps the target on the island', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  // the island's left end on its rim, and past it into the air, until the zoom takes it off the screen's edge
  let steps = 0;
  for (; steps < 12; steps++) {
    const rim = await project(page, [-26.5, 0, 0]);
    if (!rim || rim.x < 40) break;
    await page.mouse.move(rim.x - 20, rim.y);
    await page.mouse.wheel(0, -500);
    await frames(page, 3);
    const state = await camera(page);
    expect(
      insideIsland(state.target),
      `step ${steps}: target (${state.target.map((v) => v.toFixed(2))})`,
    ).toBe(true);
    expect(state.position[1]).toBeGreaterThan(0);
  }
  expect(steps).toBeGreaterThan(2);
  await settle(page);
  const { target } = await camera(page);
  expect(insideIsland(target)).toBe(true);
  expect(target[0]).toBeLessThan(-16); // it went as far as the rim lets it
  expect(errors).toEqual([]);
});

/** Dragging up lowers the camera towards (and past) the horizon: far more than the limits allow. */
async function dragDown(page: Page): Promise<void> {
  await page.mouse.move(640, 700);
  await page.mouse.down();
  await page.mouse.move(640, 60, { steps: 16 });
  await page.mouse.up();
  await settle(page);
}

test('the camera never ends up inside the rock, under the grass or in the house', async ({
  page,
}) => {
  // It zooms four times and drags three: about 27 s on its own, past the default 60 s in a full parallel run on a loaded
  // machine (load average over 20) once the koi pond and the tea corner joined the scene.
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);

  // At the closest zoom onto the house (14.5 m) it is cut down to its ground floor (AGENTS.md, Controls): the camera may
  // come lower than the house's top (HOUSE_TOP, the rooftop trellis, as orbit.test.ts measures), but stays more than
  // 2 m over the cut (2.05 m), so the cut stays on and the camera out of the walls.
  await zoomTo(page, 12);
  await dragDown(page);
  let state = await camera(page);
  expect(state.distance).toBeLessThan(16);
  expect(state.cut).toBe('ground');
  expect(state.position[1]).toBeGreaterThan(2.05 + 2);
  expect(state.position[1]).toBeLessThan(HOUSE_TOP);

  // Over the island's lawn it may come down to the trees' height, never below the ground.
  await zoomTo(page, 33);
  await dragDown(page);
  state = await camera(page);
  expect(state.position[1]).toBeGreaterThan(0);

  // From well outside the rim it may look up at the rock underside: below the ground plane, beyond the island.
  await zoomTo(page, 80);
  await dragDown(page);
  state = await camera(page);
  expect(state.position[1]).toBeLessThan(-5);
  expect(Math.hypot(state.position[0], state.position[2])).toBeGreaterThan(45);

  // Zooming in again from below lifts the camera over the ground before it reaches the island.
  await zoomTo(page, 33);
  state = await camera(page);
  expect(state.position[1]).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

/**
 * Whether the camera is in the house (scene.json: the tall house, 23 x 15 m round (-1.5, -9.5), 12.76 m high, or as high
 * as the cut on show leaves it and the 2 m over the cut that keep it on), in the rock or under the tree tops.
 */
function trouble({ position: [x, y, z], cut }: CameraState): string | null {
  const top = cut === 'ground' ? 2.05 + 2 : cut === 'upper' ? 6.86 + 2 : HOUSE_TOP;
  if (Math.abs(x + 1.5) < 11.5 && z > -17 && z < -2 && y < top) return 'in the house';
  if (y < 0 && Math.hypot(x, z) < 33) return 'in the rock';
  if (y < 3.6 && insideIsland([x, 0, z])) return 'under the tree tops';
  return null;
}

test('the camera stays out of the house and the rock round a target by the rim or beside the house', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  // by the vegetable garden's far corner on the rim, on the lawn east of the house (behind the carport's zone, x 12-20,
  // z -10 to -3), on the lawn in front of it
  for (const at of [
    [-22, 0, 17],
    [13, 0, -13],
    [-4, 0, 1],
  ] as const) {
    await gotoSite(page, '/?t=12:00');
    await waitForScene(page);
    await zoomTo(page, 12, at);
    await settle(page);
    const { target } = await camera(page);
    expect(insideIsland(target)).toBe(true);
    await dragDown(page);
    // and round, as low as it goes: every frame of the swing
    await page.mouse.move(400, 400);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(400 + 40 * i, 400);
      await frames(page, 2);
      const state = await camera(page);
      expect(
        trouble(state),
        `round (${at}) at step ${i}: (${state.position.map((v) => v.toFixed(2))}), ${state.cut}`,
      ).toBeNull();
    }
    await page.mouse.up();
    await settle(page);
    const state = await camera(page);
    expect(
      trouble(state),
      `round (${at}): (${state.position.map((v) => v.toFixed(2))}), ${state.cut}`,
    ).toBeNull();
  }
  expect(errors).toEqual([]);
});
