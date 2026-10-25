// Captures each arena from the real scene for the lobby previews:
// public/arenas/<id>-640.avif and <id>-320.avif (640×400 / 320×200).
// Needs this app's dev server (pnpm --filter @ncam/chess dev) and a Playwright
// Chromium (pnpm --filter @ncam/portfolio exec playwright install chromium).
//
// The page is the standalone one with ?capture=<id> (src/standalone.tsx): the battle
// alone, no HUD, its arena's preview camera (ARENA_DEFS[id].capture) and full
// quality, then window.__chessReady once 30 frames are drawn. SwiftShader draws it,
// so the result does not depend on the machine's GPU.
/* global window -- only referenced inside page.waitForFunction(), which runs in the browser */
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const BASE = process.env.CHESS_URL ?? `http://localhost:${process.env.CHESS_PORT ?? 9008}/`;
const OUT = fileURLToPath(new URL('../public/arenas/', import.meta.url));
const IDS = ['cloud-peak', 'blood-moon', 'lotus-lake'];

// Software WebGL can hang rather than fail: never let a capture run forever.
const watchdog = setTimeout(() => {
  console.error('arenas: gave up after 5 minutes');
  process.exit(1);
}, 300_000);
watchdog.unref();

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  page.setDefaultTimeout(20_000);
  for (const id of IDS) {
    await page.goto(`${BASE}?capture=${id}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__chessReady === true, null, { timeout: 60_000 });
    await page.waitForTimeout(1500); // let clouds / sparkles settle into frame
    const png = await page.screenshot({ type: 'png' });
    for (const [w, h] of [
      [640, 400],
      [320, 200],
    ]) {
      await sharp(png)
        .resize(w, h, { fit: 'cover' })
        .avif({ quality: 55, effort: 6 })
        .toFile(`${OUT}${id}-${w}.avif`);
    }
    console.log(`arenas: ${id}`);
  }
} finally {
  await browser.close();
}
