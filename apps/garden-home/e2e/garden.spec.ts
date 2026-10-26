import { expect, type Page, test } from '@playwright/test';
import {
  boxColor,
  boxLuma,
  brightFraction,
  collectErrors,
  frames,
  gotoSite,
  luminance,
  settle,
  waitForScene,
  zoomTo,
} from './helpers';

// Zooming in and waiting for the camera to settle takes a while when SwiftShader shares the machine with other workers:
// about 30 s on its own, up to 2 min in a full parallel run.
test.describe.configure({ timeout: 180_000 });

interface Point {
  x: number;
  y: number;
}

/** One object of each garden module (art/README.md, Garden): the fence, the paths, the beds, the vegetables, the barbecue. */
const GARDEN = [
  'Fence',
  'Gate_lamps',
  'Paving',
  'Garden_lamps',
  'Flower_beds',
  'Veg_beds',
  'Veg_garden',
  'BBQ_terrace',
  'Pergola',
  'BBQ_grill',
  'BBQ_coals',
  'String_lights_bbq',
];

async function at(page: Page, name: string): Promise<Point | null> {
  return page.evaluate(
    (n) =>
      (window as { __interact?: { at(name: string): Point | null } }).__interact?.at(n) ?? null,
    name,
  );
}

async function state(
  page: Page,
): Promise<{ toggles: Record<string, string>; hover: { label: string } | null }> {
  const found = await page.evaluate(
    () => (window as { __interact?: { state(): unknown } }).__interact?.state() ?? null,
  );
  expect(found, 'window.__interact is set on the site route').not.toBeNull();
  return found as { toggles: Record<string, string>; hover: { label: string } | null };
}

test('the wallpaper draws the garden by day and by night without console errors', async ({
  page,
}) => {
  const errors = collectErrors(page);
  for (const time of ['12:00', '21:00']) {
    await page.goto(`/wallpaper?t=${time}&bg=example.jpg`);
    await waitForScene(page);
    expect(luminance(await page.locator('canvas').screenshot()).std).toBeGreaterThan(8);
  }
  expect(errors).toEqual([]);
});

test('every garden module stands on the island in the first view of the site', async ({ page }) => {
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  for (const name of GARDEN) expect(await at(page, name), name).not.toBeNull();
  expect(errors).toEqual([]);
});

// The lawn round the walk, the driveway and their bollards in the first view of the site (the house's lit glass above it
// left out), and the luma that counts as lit there at night: the grass is about 35, the walk under the house's lights
// and the koi pond stay below it, the bollards' heads and the pools of light they cast rise above it.
const GARDEN_LAWN = { x0: 0.33, x1: 0.67, y0: 0.48, y1: 0.62 };
const LIT_LAWN = 110;

test('at night the garden lights pool on the lawn round the walk, and switching them off darkens it', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=21:00');
  await waitForScene(page);
  await frames(page, 4);
  const canvas = page.locator('canvas');
  const lit = brightFraction(await canvas.screenshot(), LIT_LAWN, GARDEN_LAWN);
  await page.evaluate(() =>
    (window as { __interact?: { toggle(group: string): void } }).__interact?.toggle(
      'lights:garden',
    ),
  );
  expect((await state(page)).toggles).toEqual({ 'lights:garden': 'off' }); // a click's effect: lit at night, so off
  await frames(page, 4);
  const dark = brightFraction(await canvas.screenshot(), LIT_LAWN, GARDEN_LAWN);
  // measured 0.018 lit and 0.004 off: the lights must add at least half the share they add on this machine
  expect(lit - dark, `lit ${lit.toFixed(4)}, off ${dark.toFixed(4)}`).toBeGreaterThan(0.007);
  expect(errors).toEqual([]);
});

test('hovering the grill names it; a click at noon lights its coals and a second click puts them out', async ({
  page,
}) => {
  // A zoom, a drag and two clicks that each wait on SwiftShader: 2.5-2.9 min in a full parallel run under load 20-40
  // once the carport and the dog's corner (part 4) joined the scene, so its three minutes ran out twice in three runs.
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  await gotoSite(page, '/?t=12:00');
  await waitForScene(page);
  // from a little higher and further round than the first view, the coals show over the barbecue terrace's kitchen
  await zoomTo(page, 42);
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(700, 460, { steps: 12 });
  await page.mouse.up();
  await settle(page);
  await frames(page, 4);
  const canvas = page.locator('canvas');
  const grill = await at(page, 'BBQ_grill');
  expect(grill, 'the grill on screen').not.toBeNull();
  const { x, y } = grill!;
  await page.mouse.move(x, y, { steps: 4 });
  await expect(page.getByTestId('hover-label')).toContainText('Barbecue');
  await expect(canvas).toHaveCSS('cursor', 'pointer');
  const coals = async () => boxLuma(await canvas.screenshot(), x, y - 4, 16, 12);
  const cold = await coals();

  await page.mouse.click(x, y);
  await expect.poll(coals, { timeout: 15_000 }).toBeGreaterThan(cold + 15);
  const [red, , blue] = boxColor(await canvas.screenshot(), x, y - 4, 16, 12);
  expect(red, 'glowing coals are orange').toBeGreaterThan(blue + 30);
  expect((await state(page)).toggles).toEqual({ bbq: 'on' }); // the garden lights are left to the night
  await page.mouse.click(x, y);
  await expect.poll(coals, { timeout: 15_000 }).toBeLessThan(cold + 5);
  expect((await state(page)).toggles).toEqual({ bbq: 'off' });
  expect(errors).toEqual([]);
});
