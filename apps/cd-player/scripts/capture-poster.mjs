// Captures the poster the page shows until the scene boots, from the real scene with its default
// prints: src/assets/poster/<shape>-<width>.avif (three widths per shape) and one WebP per shape,
// with alpha, so the page's own backdrop shows around the player. Needs this app's dev server
// (CD_PLAYER_PORT set for it and for this script) and Playwright's Chromium.
//
// The page is the standalone one with ?capture=<shape> (src/scene/CaptureScene.tsx): the scene
// alone with its default prints, then window.__sceneReady once three frames are drawn.
// SwiftShader draws it, so the result does not depend on the machine's GPU.
/* global window -- only referenced inside page.waitForFunction(), which runs in the browser */
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const BASE = process.env.CD_PLAYER_URL ?? `http://localhost:${process.env.CD_PLAYER_PORT ?? 9011}/`;
const OUT = fileURLToPath(new URL('../src/assets/poster/', import.meta.url));
/**
 * Each shape's CSS viewport and device scale, the AVIF widths and the WebP fallback width.
 * Keep in step with src/capture.ts (CAPTURE) and src/assets/poster/index.ts.
 */
const SHAPES = {
  landscape: {
    viewport: { width: 1280, height: 720 },
    scale: 2,
    avif: [1280, 1920, 2560],
    webp: 1920,
  },
  portrait: {
    viewport: { width: 390, height: 844 },
    scale: 1080 / 390,
    avif: [480, 750, 1080],
    webp: 750,
  },
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
  for (const [shape, { viewport, scale, avif, webp }] of Object.entries(SHAPES)) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
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
        await page.waitForFunction(
          () => window.__sceneReady === true || !!window.__sceneError,
          null,
          {
            timeout: 120_000,
          },
        );
        const failure = await page.evaluate(() => window.__sceneError);
        if (failure) throw new Error(`poster: ${shape}: ${failure}`);
        // Three frames are drawn: a little longer, in case anything is still easing to its rest pose.
        await page.waitForTimeout(800);
      })(),
    ]);
    const png = await page.screenshot({ type: 'png', omitBackground: true });
    await page.close();
    if (errors.length > 0) throw new Error(`poster: ${shape}: ${errors.join('; ')}`);
    for (const width of avif) {
      await sharp(png)
        .resize({ width })
        .avif({ quality: 60 })
        .toFile(`${OUT}${shape}-${width}.avif`);
    }
    await sharp(png)
      .resize({ width: webp })
      .webp({ quality: 82, alphaQuality: 90 })
      .toFile(`${OUT}${shape}-${webp}.webp`);
    console.log(`poster: ${shape}`);
  }
} finally {
  await browser.close();
}
