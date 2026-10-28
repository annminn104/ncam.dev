import { expect, type Page, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { collectErrors, waitForScene } from './helpers';

type Rgb = [number, number, number];
/** Top-left corner, away from the island the wallpaper frames on the right. */
const CORNER = { x: 10, y: 10, width: 40, height: 40 };

async function cornerOfPage(page: Page): Promise<Rgb> {
  const { data } = PNG.sync.read(await page.screenshot({ clip: CORNER }));
  const sum: Rgb = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += data[i + c];
  return sum.map((v) => v / (data.length / 4)) as Rgb;
}

/** The same corner of `src` drawn the way CSS draws it (cover, centred) over this viewport. */
async function cornerOfImage(page: Page, src: string): Promise<Rgb> {
  return page.evaluate(
    async ({ src, corner }) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const w = window.innerWidth;
      const h = window.innerHeight;
      const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      const dw = image.naturalWidth * scale;
      const dh = image.naturalHeight * scale;
      ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
      const { data } = ctx.getImageData(corner.x, corner.y, corner.width, corner.height);
      const sum = [0, 0, 0];
      for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += data[i + c];
      return sum.map((v) => v / (data.length / 4)) as [number, number, number];
    },
    { src, corner: CORNER },
  );
}

const apart = (a: Rgb, b: Rgb) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

test('?bg= shows the image behind the island instead of the sky', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/wallpaper?t=12:00');
  await waitForScene(page);
  const sky = await cornerOfPage(page);
  await page.goto('/wallpaper?t=12:00&bg=example.jpg');
  await waitForScene(page);
  const image = await cornerOfImage(page, '/backgrounds/example.jpg');
  expect(apart(image, sky)).toBeGreaterThan(40); // the corner can tell the two apart
  await expect
    .poll(async () => apart(await cornerOfPage(page), image), { timeout: 10_000 })
    .toBeLessThan(8);
  expect(errors).toEqual([]);
});

test('a ?bg= image that cannot be loaded falls back to the sky', async ({ page }) => {
  await page.goto('/wallpaper?t=12:00');
  await waitForScene(page);
  const sky = await cornerOfPage(page);
  await page.goto('/wallpaper?t=12:00&bg=missing.jpg');
  await waitForScene(page);
  await expect
    .poll(async () => apart(await cornerOfPage(page), sky), { timeout: 10_000 })
    .toBeLessThan(8);
});

test('the sky stays up until the ?bg= image has decoded, with no dark flash behind the canvas', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/wallpaper?t=12:00');
  await waitForScene(page);
  const sky = await cornerOfPage(page);

  // Hold the image back: the scene is ready, the photo is still on its way.
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/backgrounds/example.jpg', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/wallpaper?t=12:00&bg=example.jpg', { waitUntil: 'domcontentloaded' });
  await waitForScene(page);
  await page.waitForTimeout(1500);
  expect(apart(await cornerOfPage(page), sky)).toBeLessThan(8); // the sky, not the navy page background (#0b1026)

  release();
  const image = await cornerOfImage(page, '/backgrounds/example.jpg');
  await expect
    .poll(async () => apart(await cornerOfPage(page), image), { timeout: 10_000 })
    .toBeLessThan(8);
  expect(errors).toEqual([]);
});
