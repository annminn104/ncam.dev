// Captures the poster the page shows until the scene boots, from the real scene:
// src/assets/poster/<shape>-<width>.avif (three widths per shape) and one WebP per shape.
// Needs this app's dev server (pnpm --filter @ncam/garden-home dev, or on another port with
// GARDEN_HOME_PORT set for both) and Playwright's own Chromium headless shell.
//
// The page is the standalone one with ?capture=<shape> (src/capture-view.tsx): the site route's
// scene alone at 10:00, full quality, no UI, then window.__sceneReady once it has settled.
// SwiftShader draws it, so the result does not depend on the machine's GPU.
/* global window -- only referenced inside page.waitForFunction(), which runs in the browser */
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const BASE =
  process.env.GARDEN_HOME_URL ?? `http://localhost:${process.env.GARDEN_HOME_PORT ?? 9010}/`;
const OUT = fileURLToPath(new URL('../src/assets/poster/', import.meta.url));
/** Each shape's capture size, the AVIF widths and the WebP fallback width (src/assets/poster/index.ts). */
const SHAPES = {
  landscape: { width: 2560, height: 1067, avif: [1280, 1920, 2560], webp: 1920 },
  portrait: { width: 1080, height: 2160, avif: [480, 750, 1080], webp: 750 },
};

// Software WebGL can hang rather than fail: never let a capture run forever.
const watchdog = setTimeout(() => {
  console.error('poster: gave up after 20 minutes');
  process.exit(1);
}, 1_200_000);
watchdog.unref();

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const [shape, { width, height, avif, webp }] of Object.entries(SHAPES)) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors = [];
    // The first page error rejects at once, so a broken page fails the run with its own message.
    const broke = new Promise((_, reject) => {
      page.on('pageerror', (error) => {
        errors.push(String(error));
        reject(new Error(`poster: ${shape}: ${error}`));
      });
    });
    broke.catch(() => {});
    await Promise.race([
      broke,
      (async () => {
        await page.goto(`${BASE}?capture=${shape}`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.__sceneReady === true, null, {
          timeout: 600_000,
          polling: 500,
        });
      })(),
    ]);
    if (errors.length > 0) throw new Error(`poster: ${shape}: ${errors.join('; ')}`);
    const png = await page.screenshot({ type: 'png' });
    await page.close();
    const at = (w) => sharp(png).resize(w, Math.round((w * height) / width), { fit: 'cover' });
    for (const w of avif) {
      await at(w).avif({ quality: 50, effort: 6 }).toFile(`${OUT}${shape}-${w}.avif`);
    }
    await at(webp).webp({ quality: 72 }).toFile(`${OUT}${shape}-${webp}.webp`);
    console.log(`poster: ${shape}`);
  }
} finally {
  await browser.close();
}
