// Captures the piece sets from the real scene, with this app's dev server running (CHESS_URL,
// else http://localhost:$CHESS_PORT, else :9008). The page is the standalone one in capture mode
// (src/capture.ts): the battle alone, no HUD or engine, no quality decline.
//   node scripts/capture-presets.mjs            the lobby previews: each set's lineup on Cloud
//                                               Peak, drawn by SwiftShader (the same on any
//                                               machine), to public/presets/<id>-{640,320}.avif
//   node scripts/capture-presets.mjs --review [preset]
//                                               a figure set's review (default holy-order) on the
//                                               real GPU (Metal) at DPR 2: lineups at both LODs,
//                                               every arena from three views, phone views, an
//                                               orbit video and frame rates, to art/.out/review/
// CHROMIUM_PATH names a Chromium when Playwright's own build is not installed.
/* global window, requestAnimationFrame -- only inside page.evaluate / waitForFunction */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const BASE = process.env.CHESS_URL ?? `http://localhost:${process.env.CHESS_PORT ?? 9008}/`;
const local = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const [mode, reviewPreset = 'holy-order'] = process.argv.slice(2);
const review = mode === '--review';
// The sets with lobby previews (presets-meta.ts, `preview: true`).
const PREVIEWS = ['treasures', 'holy-order'];
const ARENAS = ['cloud-peak', 'blood-moon', 'lotus-lake'];
// Figure presets: their pages fetch six figure files each.
const FIGURES = Object.keys(JSON.parse(await readFile(local('art/budgets.json'), 'utf8')));

// Software WebGL can hang rather than fail: never let a capture run forever.
const watchdog = setTimeout(() => {
  console.error('presets: gave up after 15 minutes');
  process.exit(1);
}, 900_000);
watchdog.unref();

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: review
    ? ['--use-angle=metal', '--enable-gpu']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

/** A page whose every request reaches the server, so open() sees each figure file arrive. */
async function freshPage(target, options) {
  const page = await target.newPage(options);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  page.setDefaultTimeout(30_000);
  return page;
}

/**
 * Opens a capture and waits until its figures are drawn: the battle's 30 frames, each figure
 * file of the quality it draws, then a moment for the first draws and the shadows.
 */
async function open(page, query) {
  const params = new URLSearchParams(query);
  const expected = FIGURES.includes(params.get('preset') ?? '') ? 6 : 0;
  const low = params.get('quality') === 'low';
  const loaded = new Set();
  const seen = (response) => {
    const url = response.url();
    const good = response.status() < 400;
    if (good && url.endsWith('.glb') && url.endsWith('-low.glb') === low) loaded.add(url);
  };
  page.on('response', seen);
  await page.goto(`${BASE}?${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__chessReady === true, null, { timeout: 120_000 });
  for (let i = 0; loaded.size < expected && i < 150; i++) await page.waitForTimeout(200);
  page.off('response', seen);
  if (loaded.size < expected)
    throw new Error(`${query}: ${loaded.size} of ${expected} figure files`);
  await page.waitForTimeout(2000);
}

try {
  if (!review) {
    const out = local('public/presets/');
    await mkdir(out, { recursive: true });
    const page = await freshPage(browser, {
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    for (const id of PREVIEWS) {
      await open(page, `capture=cloud-peak&preset=${id}&lineup`);
      const png = await page.screenshot({ type: 'png' });
      for (const [w, h] of [
        [640, 400],
        [320, 200],
      ]) {
        await sharp(png)
          .resize(w, h, { fit: 'cover' })
          .avif({ quality: 55, effort: 6 })
          .toFile(`${out}${id}-${w}.avif`);
      }
      console.log(`presets: ${id}`);
    }
  } else {
    const out = local(`art/.out/review/${reviewPreset}/`);
    await mkdir(out, { recursive: true });
    const desktop = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 };
    const phone = { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 };
    const set = `preset=${reviewPreset}`;
    const shot = async (page, query, name) => {
      await open(page, query);
      await page.screenshot({ path: `${out}${name}.png`, type: 'png' });
      console.log(`review: ${name}`);
    };

    const page = await freshPage(browser, desktop);
    await shot(page, `capture=cloud-peak&${set}&lineup`, 'lineup-high');
    await shot(page, `capture=cloud-peak&${set}&lineup&quality=low`, 'lineup-low');
    const rates = [];
    for (const arena of ARENAS) {
      for (const view of ['home', 'close', 'far']) {
        await shot(page, `capture=${arena}&${set}&view=${view}`, `${arena}-${view}`);
      }
      await open(page, `capture=${arena}&${set}&view=home`);
      const fps = await page.evaluate(
        () =>
          new Promise((done) => {
            let frames = 0;
            const start = performance.now();
            const tick = () => {
              frames += 1;
              if (performance.now() - start < 10_000) requestAnimationFrame(tick);
              else done(frames / ((performance.now() - start) / 1000));
            };
            requestAnimationFrame(tick);
          }),
      );
      rates.push(`${arena}: ${fps.toFixed(1)} fps`);
    }
    await page.close();

    const small = await freshPage(browser, phone);
    for (const arena of ARENAS)
      await shot(small, `capture=${arena}&${set}&view=home`, `${arena}-phone`);
    await small.close();

    const context = await browser.newContext({
      ...desktop,
      recordVideo: { dir: `${out}video/`, size: { width: 1280, height: 800 } },
    });
    const filming = await freshPage(context);
    await open(filming, `capture=cloud-peak&${set}&view=orbit`);
    await filming.waitForTimeout(20_000);
    const saved = filming.video().saveAs(`${out}orbit.webm`);
    await context.close();
    await saved;

    await writeFile(`${out}fps.txt`, `${rates.join('\n')}\n`);
    console.log(rates.join('\n'));
  }
} finally {
  await browser.close();
}
