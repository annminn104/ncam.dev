import { expect, type Page, test } from '@playwright/test';
import {
  boxLuma,
  camera,
  collectErrors,
  frames,
  gotoSite,
  project,
  settle,
  waitForScene,
  zoomTo,
} from './helpers';

// The tall house (art/README.md, Glass villa): its double-height living room's crystal chandelier, which the dollhouse cut clips
// at the void's plane rather than at the ground floor's cut, and the bedrooms' air conditioners. Each test zooms in and
// waits for the camera: a minute on its own, longer on SwiftShader under load.
test.describe.configure({ timeout: 240_000 });

/** The chandelier's middle in world space (glTF, Y up): module (-7.4, -2.8), 4.6 m up, in the slot at (-1.5, 9.5). */
const CHANDELIER = [-8.9, 4.6, -6.7] as const;
/** The master bedroom's air conditioner remote: module (4.1, 1.43), 1.21 m over the upper floor (5.28 m). */
const AC_REMOTE = [2.6, 6.49, -10.93] as const;

interface Point {
  x: number;
  y: number;
}

async function hover(page: Page): Promise<{ group: string; label: string; node: string } | null> {
  return page.evaluate(
    () =>
      (
        window as {
          __interact?: {
            state(): { hover: { group: string; label: string; node: string } | null };
          };
        }
      ).__interact!.state().hover,
  );
}

async function toggles(page: Page): Promise<Record<string, string>> {
  return page.evaluate(
    () =>
      (
        window as { __interact?: { state(): { toggles: Record<string, string> } } }
      ).__interact!.state().toggles,
  );
}

/**
 * The first point round `near` (rings of 3 px out to `radius`) where the pointer names `label`: the chandelier's rings
 * and drops are a few pixels wide, so the pointer has to find them rather than its middle.
 */
async function pointAt(page: Page, near: Point, label: string, radius = 24): Promise<Point> {
  for (let r = 0; r <= radius; r += 3) {
    for (let k = 0; k < (r ? 8 : 1); k++) {
      const point = {
        x: Math.round(near.x + r * Math.cos((k * Math.PI) / 4)),
        y: Math.round(near.y + r * Math.sin((k * Math.PI) / 4)),
      };
      await page.mouse.move(point.x, point.y);
      await frames(page, 3);
      if ((await hover(page))?.label.includes(label)) return point;
    }
  }
  throw new Error(`no point within ${radius} px of (${near.x}, ${near.y}) names ${label}`);
}

/** Keeps the scenes three announces to window.__THREE_DEVTOOLS__, to read a node's rotation. */
async function watchScenes(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const hook = new EventTarget();
    hook.addEventListener('observe', (event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.isScene)
        ((window as unknown as { __scenes?: unknown[] }).__scenes ??= []).push(detail);
    });
    (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__ = hook;
  });
}

/** The rotation about X of the glTF node `name` (radians), null when no scene holds it. */
async function rotationX(page: Page, name: string): Promise<number | null> {
  return page.evaluate((n) => {
    type Node = { userData: { name?: string }; rotation: { x: number } };
    let found: Node | null = null;
    for (const scene of (
      window as unknown as { __scenes?: { traverse(f: (o: Node) => void): void }[] }
    ).__scenes ?? []) {
      scene.traverse((object) => {
        if (!found && object.userData.name === n) found = object;
      });
    }
    return found ? (found as Node).rotation.x : null;
  }, name);
}

async function zoomOnto(
  page: Page,
  time: string,
  distance: number,
  at: readonly number[],
): Promise<void> {
  await gotoSite(page, `/?t=${time}`);
  await waitForScene(page);
  await zoomTo(page, distance, at);
  await settle(page);
  await frames(page, 4);
}

test('at 21:00 the crystal chandelier lights the double-height living room, and a click on it puts the room out', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await zoomOnto(page, '21:00', 36, CHANDELIER); // the roof is off, the void and the gallery show
  expect((await camera(page)).cut).toBe('upper');
  const canvas = page.locator('canvas');
  const centre = (await project(page, CHANDELIER))!;
  await page.mouse.move(1270, 790);
  await frames(page, 4);
  // its crystals and the walls round it: 157 lit, 58 with the room's lights out (box luma)
  const region = async () => boxLuma(await canvas.screenshot(), centre.x, centre.y + 6, 12, 12);
  const lit = await region();
  const point = await pointAt(page, centre, 'Crystal chandelier');
  expect((await hover(page))?.group).toBe('light:living');
  await page.mouse.click(point.x, point.y);
  await page.mouse.move(1270, 790);
  // a light count change recompiles the shaders: give SwiftShader the time
  await expect.poll(region, { timeout: 30_000 }).toBeLessThan(lit - 30);
  expect((await toggles(page))['light:living']).toBe('off');
  expect(errors).toEqual([]);
});

test('zoomed into the living room under the ground floor cut, the chandelier still hangs in the void and takes a click', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await zoomOnto(page, '21:00', 22, CHANDELIER);
  expect((await camera(page)).cut).toBe('ground');
  // the pointer only finds what the cut leaves (interact/pick): the chandelier, up to its crown, over the cut walls
  const point = await pointAt(page, (await project(page, CHANDELIER))!, 'Crystal chandelier');
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(async () => (await toggles(page))['light:living'], { timeout: 20_000 })
    .toBe('off');
  expect(errors).toEqual([]);
});

test("a click on the master bedroom's air conditioner remote at noon starts it: its louvre swings open, a second shuts it", async ({
  page,
}) => {
  await watchScenes(page);
  const errors = collectErrors(page);
  await zoomOnto(page, '12:00', 30, AC_REMOTE);
  expect((await camera(page)).cut).toBe('upper'); // the unit hangs over the cut, its remote under it
  const near = await page.evaluate(() =>
    (window as { __interact?: { at(name: string): Point | null } }).__interact!.at(
      'AC_remote_master',
    ),
  );
  expect(near, 'the remote on screen').not.toBeNull();
  const point = await pointAt(page, near!, 'Master bedroom AC remote', 9);
  await expect(page.getByTestId('hover-label')).toContainText('Click to switch on'); // auto is off, day or night
  expect(await rotationX(page, 'AC_master_flap')).toBeCloseTo(0, 3);
  await page.mouse.click(point.x, point.y);
  // its act_ac_master clip turns the flap -60 degrees (-1.05 rad) about X
  await expect
    .poll(async () => rotationX(page, 'AC_master_flap'), { timeout: 20_000 })
    .toBeLessThan(-0.5);
  expect((await toggles(page))['ac:master']).toBe('on');
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(async () => rotationX(page, 'AC_master_flap'), { timeout: 20_000 })
    .toBeGreaterThan(-0.5);
  expect((await toggles(page))['ac:master']).toBe('off');
  expect(errors).toEqual([]);
});
