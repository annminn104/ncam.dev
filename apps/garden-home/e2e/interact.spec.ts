import { expect, type Page, test } from '@playwright/test';
import {
  boxColor,
  boxLuma,
  camera,
  collectErrors,
  frames,
  gotoSite,
  pick,
  settle,
  waitForScene,
  zoomTo,
} from './helpers';

// Zooming in and waiting for the camera to settle takes a while when SwiftShader shares the machine with other workers:
// up to 1.2 min under load 20 once the carport and the dog's corner (part 4) joined the scene.
test.describe.configure({ timeout: 180_000 });

interface Point {
  x: number;
  y: number;
}

/** Where a glTF node of the scene shows on the canvas (window.__interact, site route only): its bounding box's centre. */
async function at(page: Page, name: string): Promise<Point> {
  const point = await page.evaluate(
    (n) =>
      (window as { __interact?: { at(name: string): Point | null } }).__interact?.at(n) ?? null,
    name,
  );
  expect(point, `${name} on screen`).not.toBeNull();
  return point!;
}

async function hover(page: Page): Promise<{ group: string; label: string; node: string } | null> {
  const state = await page.evaluate(
    () =>
      (
        window as {
          __interact?: {
            state(): { hover: { group: string; label: string; node: string } | null };
          };
        }
      ).__interact?.state() ?? null,
  );
  expect(state, 'window.__interact is set on the site route').not.toBeNull();
  return state!.hover;
}

async function toggles(page: Page): Promise<Record<string, string>> {
  const state = await page.evaluate(
    () =>
      (
        window as { __interact?: { state(): { toggles: Record<string, string> } } }
      ).__interact?.state().toggles ?? null,
  );
  expect(state, 'window.__interact is set on the site route').not.toBeNull();
  return state!;
}

/** The TV hangs on the west face of the tall house's media wall: a drag of this many pixels on the sky turns the view to see it. */
const TV_SIDE = 220;

/**
 * Close enough for the ground-floor cut (24 m from the house focus: it starts under 25 m), the living room and the front
 * door seen from above, at noon (interaction spec §2, §3). The zoom goes towards the house's middle, under the cursor;
 * with `turn`, a drag along the sky first turns the view round its target (TV_SIDE: from the south west).
 */
async function closeUp(page: Page, turn = 0): Promise<void> {
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  if (turn) {
    let sky: Point | null = null;
    for (const x of [640, 480, 800, 320, 960])
      if (!sky && (await pick(page, x, 12)) === null) sky = { x, y: 12 };
    expect(sky, 'some sky along the top of the view').not.toBeNull();
    await page.mouse.move(sky!.x, sky!.y);
    await page.mouse.down();
    await page.mouse.move(sky!.x + turn, sky!.y, { steps: 12 });
    await page.mouse.up();
    await settle(page);
  }
  await zoomTo(page, 24);
  await settle(page);
  await frames(page, 4);
  expect((await camera(page)).cut).toBe('ground');
}

test('hovering the TV names it; a click at noon lights its screen as a blue-ish panel and a second click puts it out', async ({
  page,
}) => {
  // The furnished ground-floor close-up draws at ~190 ms a frame on SwiftShader (curtains and accessories under the cut),
  // and this test waits on six screen polls there: 34 s alone, but up to 3 min in a full run at load 25.
  test.setTimeout(300_000);
  const errors = collectErrors(page);
  await closeUp(page, TV_SIDE);
  const canvas = page.locator('canvas');
  const tv = await at(page, 'TV_wall');
  await page.mouse.move(tv.x, tv.y, { steps: 4 });
  await expect(page.getByTestId('hover-label')).toContainText('Living room TV');
  await expect(canvas).toHaveCSS('cursor', 'pointer');
  const screen = async () => boxLuma(await canvas.screenshot(), tv.x, tv.y, 24, 12);
  const dark = await screen();

  await page.mouse.click(tv.x, tv.y);
  await expect.poll(screen, { timeout: 15_000 }).toBeGreaterThan(dark + 40);
  expect((await toggles(page))['tv:TV_wall']).toBe('on');
  // by day the lit screen is capped: a blue-ish panel (it came out near white, over 230, at full strength)
  await expect.poll(screen, { timeout: 15_000 }).toBeLessThan(200);
  const [red, , blue] = boxColor(await canvas.screenshot(), tv.x, tv.y, 24, 12);
  expect(blue, 'a blue-ish panel').toBeGreaterThan(red + 15);
  await page.mouse.click(tv.x, tv.y);
  await expect.poll(screen, { timeout: 15_000 }).toBeLessThan(dark + 10);
  expect((await toggles(page))['tv:TV_wall']).toBe('off');
  expect(errors).toEqual([]);
});

test('a click on the floor lamp at noon lights the living room', async ({ page }) => {
  const errors = collectErrors(page);
  await closeUp(page);
  const canvas = page.locator('canvas');
  const lamp = await at(page, 'Floor_lamp');
  const rug = await at(page, 'Rug_living');
  await page.mouse.move(lamp.x, lamp.y, { steps: 4 });
  await expect(page.getByTestId('hover-label')).toContainText('Living room lights');
  const room = async () => boxLuma(await canvas.screenshot(), rug.x, rug.y, 120, 60);
  const before = await room();

  await page.mouse.click(lamp.x, lamp.y);
  // a light count change recompiles the shaders: give SwiftShader the time
  await expect.poll(room, { timeout: 20_000 }).toBeGreaterThan(before + 12);
  expect((await toggles(page))['light:living']).toBe('on');
  expect(errors).toEqual([]);
});

test('hovering the wall switch of the living room names it; a click at noon lights the whole room', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await closeUp(page);
  const canvas = page.locator('canvas');
  // the switch sits on the west wall, 1.15 m up, about 4 px wide from here: the reach of the room's lights under the cut
  const wall = await at(page, 'Switch_living');
  const rug = await at(page, 'Rug_living');
  await page.mouse.move(wall.x, wall.y, { steps: 4 });
  await expect(page.getByTestId('hover-label')).toContainText('Living room light switch');
  await expect(canvas).toHaveCSS('cursor', 'pointer');
  const room = async () => boxLuma(await canvas.screenshot(), rug.x, rug.y, 120, 60);
  const before = await room();

  await page.mouse.click(wall.x, wall.y);
  await expect.poll(room, { timeout: 20_000 }).toBeGreaterThan(before + 12);
  expect((await toggles(page))['light:living']).toBe('on');
  expect(errors).toEqual([]);
});

test('a drag that starts on the TV turns the camera and leaves the TV alone', async ({ page }) => {
  const errors = collectErrors(page);
  await closeUp(page, TV_SIDE);
  const tv = await at(page, 'TV_wall');
  const before = await camera(page);
  await page.mouse.move(tv.x, tv.y);
  await page.mouse.down();
  await page.mouse.move(tv.x + 80, tv.y + 10, { steps: 8 });
  await page.mouse.up();
  await frames(page, 10); // a click would have toggled on the release; damping has turned the camera metres by now
  const after = await camera(page);
  expect(Math.hypot(...after.position.map((v, k) => v - before.position[k]))).toBeGreaterThan(1);
  expect((await toggles(page))['tv:TV_wall']).toBeUndefined();
  expect(errors).toEqual([]);
});

test('a press that strays off the TV and comes back to it is a drag too, not a click', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await closeUp(page, TV_SIDE);
  const tv = await at(page, 'TV_wall');
  await page.mouse.move(tv.x, tv.y);
  await page.mouse.down();
  await page.mouse.move(tv.x + 80, tv.y + 10, { steps: 8 });
  await page.mouse.move(tv.x, tv.y, { steps: 8 });
  await settle(page); // damping has turned the camera back: the TV is under the pointer again
  const back = await at(page, 'TV_wall');
  expect(Math.hypot(back.x - tv.x, back.y - tv.y), 'the TV is back under the pointer').toBeLessThan(
    20,
  );
  await page.mouse.up(); // released on the spot it was pressed, over the TV
  await frames(page, 10);
  expect((await toggles(page))['tv:TV_wall']).toBeUndefined();
  expect(errors).toEqual([]);
});

test('the label goes when the cut takes the item from under a pointer that rests', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  // the roof is off, the upper floor shows: 40 m out the camera is high enough over the tall house's upper cut (8.86 m)
  await zoomTo(page, 40);
  await settle(page);
  await frames(page, 4);
  expect((await camera(page)).cut).toBe('upper');
  // the master bedroom's light switch, on the wall between it and its closet, faces this side: upstairs, under the cut
  const spot = await at(page, 'Switch_master');
  await page.mouse.move(spot.x, spot.y, { steps: 4 });
  await expect(page.getByTestId('hover-label')).toContainText('Master bedroom light switch');
  const item = (await hover(page))!.node;
  await page.mouse.wheel(0, -1200); // zoom in with the mouse where it is: no pointer event follows
  await settle(page);
  await frames(page, 6);
  // the zoom went towards the switch and the ground floor cut took the upper floor away from under the pointer
  expect((await camera(page)).cut).toBe('ground');
  expect((await hover(page))?.node).not.toBe(item);
  await expect(page.getByTestId('hover-label').filter({ hasText: 'Master bedroom' })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

test('the label follows what the camera alone turns under a pointer that rests', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await closeUp(page, TV_SIDE);
  // a drag on the sky over the house, released: damping turns the camera on round the target for a second or two
  await page.mouse.move(640, 5);
  await page.mouse.down();
  await page.mouse.move(490, 5, { steps: 3 });
  await page.mouse.up();
  await frames(page, 8);
  // what is hovered and the cut, every frame from now on
  await page.evaluate(() => {
    const seen: { node: string | null; cut: string }[] = [];
    const hooks = window as unknown as {
      __seen: typeof seen;
      __interact: { state(): { hover: { node: string } | null } };
      __camera: () => { cut: string };
    };
    hooks.__seen = seen;
    const tick = () => {
      seen.push({ node: hooks.__interact.state().hover?.node ?? null, cut: hooks.__camera().cut });
      if (seen.length < 2000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // the pointer onto the TV as the camera still turns (no button down: a press hovers nothing), then at rest
  const tv = await at(page, 'TV_wall');
  await page.mouse.move(tv.x, tv.y);
  await settle(page);
  await frames(page, 4);
  const seen = await page.evaluate(
    () => (window as unknown as { __seen: { node: string | null; cut: string }[] }).__seen,
  );
  expect(new Set(seen.map((frame) => frame.cut)), 'the cut stayed: only the camera moved').toEqual(
    new Set(['ground']),
  );
  expect(
    seen.some((frame) => frame.node === 'TV_wall'),
    'the TV was named while under the pointer',
  ).toBe(true);
  const away = await page.evaluate(() =>
    (
      window as { __interact?: { at(name: string): { x: number; y: number } | null } }
    ).__interact!.at('TV_wall'),
  );
  // from the south west the TV stands near the middle of the turn: it slides 46 to 50 px away (measured over four runs
  // on two workers), so 20 px keeps more than a 2x margin; the hover checks below tell whether it left the pointer
  if (away)
    expect(
      Math.hypot(away.x - tv.x, away.y - tv.y),
      'the TV turned away from under the pointer',
    ).toBeGreaterThan(20);
  const rest = await hover(page);
  expect(rest?.node ?? null).not.toBe('TV_wall');
  await expect(page.getByTestId('hover-label').filter({ hasText: 'Living room TV' })).toHaveCount(
    0,
  );
  // and it names what a fresh look under the pointer finds (a pixel's move makes R3F look again)
  await page.mouse.move(tv.x + 1, tv.y);
  await frames(page, 4);
  expect((await hover(page))?.node ?? null).toBe(rest?.node ?? null);
  expect(errors).toEqual([]);
});

test('the label goes when the door slides from under the pointer', async ({ page }) => {
  const errors = collectErrors(page);
  await closeUp(page);
  const door = await at(page, 'Door_main');
  await page.mouse.move(door.x, door.y, { steps: 4 });
  await expect(page.getByTestId('hover-label')).toContainText('Front door');
  await page.mouse.click(door.x, door.y); // the leaf slides a full width aside
  await expect
    .poll(async () => (await hover(page))?.group ?? null, { timeout: 20_000 })
    .not.toBe('door:main');
  expect((await toggles(page))['door:main']).toBe('on');
  expect(errors).toEqual([]);
});

test('the wallpaper names nothing, keeps its cursor and toggles nothing', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/wallpaper?t=12:00');
  await waitForScene(page);
  const canvas = page.locator('canvas');
  // over the house, which sits right of the middle on the wallpaper (align=right)
  for (const [x, y] of [
    [870, 330],
    [930, 300],
    [1000, 360],
    [820, 400],
  ]) {
    await page.mouse.move(x, y, { steps: 3 });
    await frames(page, 2);
  }
  await page.mouse.click(900, 330);
  await frames(page, 2);
  await expect(page.getByTestId('hover-label')).toHaveCount(0);
  expect(await canvas.evaluate((element) => getComputedStyle(element).cursor)).not.toBe('pointer');
  expect(await page.evaluate(() => 'interact' in window || '__interact' in window)).toBe(false);
  expect(errors).toEqual([]);
});
