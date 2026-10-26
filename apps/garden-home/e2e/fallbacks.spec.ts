import { expect, test } from '@playwright/test';
import { gotoSite, luminance, waitForScene } from './helpers';

test('missing scene.json falls back to the poster in production builds', async ({ page }) => {
  await page.route('**/assets/scene.json', (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  );
  await page.goto('/wallpaper');
  await expect(page.locator('.gh-poster img')).toBeVisible();
  await expect(page.locator('.gh-poster img')).toHaveCSS('object-fit', 'cover');
});

test('on the site route a missing scene.json says so over the poster and offers a retry', async ({
  page,
}) => {
  await page.route('**/assets/scene.json', (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  );
  await gotoSite(page, '/');
  const gate = page.getByRole('alert');
  await expect(gate).toContainText("The 3D garden couldn't start. Please try again.");
  await expect(gate.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.locator('.gh-poster img')).toBeVisible();
});

test('a broken module only removes its own slot', async ({ page }) => {
  await page.route('**/assets/scene.json', async (route) => {
    const response = await route.fetch();
    const scene = await response.json();
    scene.modules.ghost = {
      ...scene.modules.koi_pond,
      src: { high: 'modules/ghost.high.glb', medium: 'modules/ghost.medium.glb' },
    };
    scene.slots.push({ ...scene.slots[0], id: 'ghost_01', module: 'ghost' });
    await route.fulfill({ response, json: scene });
  });
  await page.goto('/wallpaper?t=12:00');
  await waitForScene(page);
  expect(luminance(await page.locator('canvas').screenshot()).std).toBeGreaterThan(8);
});

test('losing the WebGL context for good shows the poster', async ({ page }) => {
  await page.goto('/wallpaper?t=12:00');
  await waitForScene(page);
  await page.evaluate(() => {
    const gl = document.querySelector('canvas')?.getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(page.locator('.gh-poster img')).toBeVisible({ timeout: 6_000 });
});

test('debug overlay reports fps and visibility', async ({ page }) => {
  await page.goto('/wallpaper?debug=1');
  // The overlay's one-second timer runs only once loading the modules leaves the main thread free: about 2.7 s on its
  // own, past the 5 s the check below allows in a full parallel run on a loaded machine.
  await waitForScene(page);
  await expect(page.locator('.debug')).toContainText('fps', { timeout: 5_000 });
  await expect(page.locator('.debug')).toContainText('visibility visible');
});
