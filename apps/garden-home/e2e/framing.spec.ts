import { expect, type Page, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { collectErrors, waitForScene } from './helpers';

/** Busy (the island) against plain (the noon sky, a smooth gradient): luma spread over parts of the canvas. */
async function spreads(page: Page) {
  const { data, width, height } = PNG.sync.read(await page.locator('canvas').screenshot());
  const spread = (x0: number, x1: number, y0 = 0, y1 = 1) => {
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let y = Math.round(y0 * height); y < Math.round(y1 * height); y++) {
      for (let x = Math.round(x0 * width); x < Math.round(x1 * width); x++) {
        const i = (y * width + x) * 4;
        const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        sum += luma;
        sumSq += luma * luma;
        n += 1;
      }
    }
    return Math.sqrt(Math.max(0, sumSq / n - (sum / n) ** 2));
  };
  return {
    left: spread(0.02, 0.25),
    right: spread(0.75, 0.98),
    // A frame whose edges are all sky holds the whole island.
    edges: Math.max(
      spread(0, 0.015),
      spread(0.985, 1),
      spread(0, 1, 0, 0.03),
      spread(0, 1, 0.97, 1),
    ),
  };
}

test('the wallpaper shows the whole island on the right (also on 4:3) unless ?align= says otherwise', async ({
  page,
}) => {
  const errors = collectErrors(page);
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1512, height: 982 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/wallpaper?t=12:00');
    await waitForScene(page);
    const right = await spreads(page);
    expect(right.right).toBeGreaterThan(10);
    expect(right.left).toBeLessThan(3);
    expect(right.edges).toBeLessThan(3);
  }
  await page.goto('/wallpaper?t=12:00&align=left');
  await waitForScene(page);
  const left = await spreads(page);
  expect(left.left).toBeGreaterThan(10);
  expect(left.right).toBeLessThan(3);
  expect(errors).toEqual([]);
});
