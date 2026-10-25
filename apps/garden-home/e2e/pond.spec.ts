import { expect, type Page, test } from '@playwright/test';
import { boxLuma, collectErrors, frames, luminance, settle, waitForScene, zoomTo } from './helpers';

// Zooming in and waiting for the camera to settle takes a while when SwiftShader shares the machine with other workers.
test.describe.configure({ timeout: 180_000 });

interface Point {
  x: number;
  y: number;
}

/** The objects of the koi pond and the tea corner by it (villa v2 part 3). */
const POND = [
  'Pond_bank',
  'Pond_stones',
  'Rockery',
  'WATER_surface',
  'WATER_waterfall_sheet',
  'Waterfall_foam',
  'Koi',
  'Lotus',
  'Tea_corner',
  'Bonsai',
  'Stone_lantern',
];

async function at(page: Page, name: string): Promise<Point | null> {
  return page.evaluate(
    (n) =>
      (window as { __interact?: { at(name: string): Point | null } }).__interact?.at(n) ?? null,
    name,
  );
}

/** The node the hover names (label and box), or null. */
async function hovered(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      (
        window as { __interact?: { state(): { hover: { node: string } | null } } }
      ).__interact?.state().hover?.node ?? null,
  );
}

async function toggles(page: Page): Promise<Record<string, string>> {
  const found = await page.evaluate(
    () =>
      (
        window as { __interact?: { state(): { toggles: Record<string, string> } } }
      ).__interact?.state() ?? null,
  );
  expect(found, 'window.__interact is set on the site route').not.toBeNull();
  return found!.toggles;
}

test('the wallpaper draws the koi pond and the tea corner by day and by night without console errors', async ({
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

test('the koi pond and the tea corner stand on the island in the first view of the site', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  for (const name of POND) expect(await at(page, name), name).not.toBeNull();
  expect(errors).toEqual([]);
});

// From 40 m, as the site turns towards the house, the pond fills the lower left of the view and the rockery stands out
// over it: the falling water is a pale sheet in front of the grey rock.
const CLOSE = 40;

test('a click on the waterfall stops it, a second on the rockery behind starts it again', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  await zoomTo(page, CLOSE);
  await settle(page);
  await frames(page, 4);
  const canvas = page.locator('canvas');
  const sheet = await at(page, 'WATER_waterfall_sheet');
  expect(sheet, 'the waterfall on screen').not.toBeNull();
  const { x, y } = sheet!;
  await page.mouse.move(x, y, { steps: 4 });
  await expect(page.getByTestId('hover-label')).toContainText('Thác nước');
  await expect(canvas).toHaveCSS('cursor', 'pointer');
  expect(await hovered(page)).toBe('WATER_waterfall_sheet');
  // the streaks slide down the sheet, so its luma flickers by a few levels: compare running with stopped, not frames
  const water = async () => boxLuma(await canvas.screenshot(), x, y, 6, 12);
  const running = await water();

  await page.mouse.click(x, y);
  expect(await toggles(page)).toEqual({ waterfall: 'off' }); // it runs on auto, so a click stops it
  // the sheet is gone from under the resting pointer: the hover (its box and label) moves to the rockery behind it
  await expect.poll(() => hovered(page), { timeout: 10_000 }).toBe('Rockery');
  await expect.poll(water, { timeout: 15_000 }).toBeLessThan(running - 20); // the grey rock shows where it fell
  const stopped = await water(); // measured 146 stopped, 190 running
  await page.mouse.click(x, y);
  expect(await toggles(page)).toEqual({ waterfall: 'on' });
  await expect.poll(water, { timeout: 15_000 }).toBeGreaterThan(stopped + 20);
  expect(errors).toEqual([]);
});

test('hovering the pond offers to feed the koi; a click drops the food and toggles nothing', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?t=12:00');
  await waitForScene(page);
  await zoomTo(page, CLOSE);
  await settle(page);
  await frames(page, 4);
  const pond = await at(page, 'WATER_surface');
  expect(pond, 'the pond on screen').not.toBeNull();
  // a little north-east of its middle: open water, clear of the lotus clusters
  const x = pond!.x + 30;
  const y = pond!.y - 12;
  await page.mouse.move(x, y, { steps: 4 });
  await expect(page.getByTestId('hover-label')).toContainText('Cho cá ăn');
  await expect(page.getByTestId('hover-label')).toContainText('Bấm để cho cá ăn');
  await page.mouse.click(x, y);
  const fed = await page.evaluate(() =>
    (
      window as { __interact?: { state(): { feed: unknown; toggles: unknown } } }
    ).__interact?.state(),
  );
  // where it fell (world space, on the water) and when, on the shared clock
  expect(fed?.feed, 'the food on the pond').toMatchObject({
    point: [expect.any(Number), expect.any(Number), expect.any(Number)],
    at: expect.any(Number),
  });
  expect(fed?.toggles).toEqual({});
  expect(errors).toEqual([]);
});
