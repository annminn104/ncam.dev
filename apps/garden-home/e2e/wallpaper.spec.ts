import { expect, test } from '@playwright/test';
import { brightFraction, collectErrors, luminance, type Region, waitForScene } from './helpers';

/**
 * Where the island and the house sit on a 1280 x 800 wallpaper frame with align=right (the optical axis at 68 %): the rim
 * spans x 39-96 % and y 38-73 % (rock included), the house reaches up to y 28 %. Measured around it, with a margin.
 */
const ISLAND: Region = { x0: 0.37, x1: 0.985, y0: 0.26, y1: 0.75 };

test('wallpaper renders every module without console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/wallpaper?t=12:00');
  await waitForScene(page);
  const shot = luminance(await page.locator('canvas').screenshot());
  expect(shot.std).toBeGreaterThan(8); // a real scene, not a flat clear color
  expect(errors).toEqual([]);
});

test('night is clearly darker than noon', async ({ page }) => {
  await page.goto('/wallpaper?t=12:00');
  await waitForScene(page);
  const noon = luminance(await page.locator('canvas').screenshot());
  await page.goto('/wallpaper?t=21:00');
  await waitForScene(page);
  const night = luminance(await page.locator('canvas').screenshot());
  expect(noon.mean - night.mean).toBeGreaterThan(25);
  expect(night.mean).toBeGreaterThan(15); // moonlight keeps the yard readable, not a black frame
});

test('at night the glass villa glows from inside', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/wallpaper?t=21:00');
  await waitForScene(page);
  const canvas = page.locator('canvas');
  // Night lights switch on through a React effect and a shader recompile after the scene reports ready, so poll.
  // Interior lights, downlights and LED strips make 0.8 % of the island's screen region brighter than luma 150 (0.3 % above
  // 170), where the whole frame only has 0.24 % (0.08 %), diluted by the empty night sky. With every night light off the
  // share is exactly 0, even at luma 120. A 0.3 % threshold keeps well clear of both.
  await expect
    .poll(async () => brightFraction(await canvas.screenshot(), 150, ISLAND), { timeout: 15_000 })
    .toBeGreaterThan(0.003);
  expect(luminance(await canvas.screenshot()).mean).toBeLessThan(60);
  expect(errors).toEqual([]);
});
