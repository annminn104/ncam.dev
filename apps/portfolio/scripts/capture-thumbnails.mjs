#!/usr/bin/env node
/**
 * Capture gallery thumbnails.
 *
 * For every live project in @ncam/project-registry, opens the project's page on
 * the running portfolio host (`/projects/<id>`), hides the host's fixed
 * "← Projects" button, and saves a 1200×630 viewport screenshot to the path the
 * registry declares (`public/thumbnails/<id>.jpg`; `.png` also accepted). The
 * same file doubles as the page's og:image, hence the 1200×630 size.
 *
 * Prerequisites:
 *   - `pnpm dev` at the repo root (host + every remote running)
 *   - a Playwright Chromium: `pnpm --filter @ncam/portfolio exec playwright install chromium`
 *   - Node ≥ 22.18 (imports the TypeScript registry via built-in type stripping)
 *
 *   pnpm thumbnails                      # every live project
 *   pnpm thumbnails viktor mindloop      # a subset, by registry id
 *
 * Env:
 *   PORTFOLIO_URL        host origin (default http://localhost:9000)
 *   THUMBNAIL_SETTLE_MS  extra wait for entrance animations (default 3000)
 */
/* global document, getComputedStyle -- only referenced inside page.evaluate() callbacks, which run in the browser */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { projects } from '@ncam/project-registry';

// Matches `.card__thumb { aspect-ratio: 1200 / 630 }` and the og:image size.
const WIDTH = 1200;
const HEIGHT = 630;
const BASE_URL = (process.env.PORTFOLIO_URL ?? 'http://localhost:9000').replace(/\/+$/, '');
const SETTLE_MS = Number(process.env.THUMBNAIL_SETTLE_MS ?? 3000);
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

// Host chrome that must never appear in a project's thumbnail.
const HIDE_HOST_CHROME_CSS = '.stage__back { display: none !important; }';

// Output encoding follows the extension the registry declares. JPEG is the
// default choice: these are photographic video frames, ~5× smaller than PNG.
const FORMAT_BY_EXT = {
  '.jpg': { type: 'jpeg', quality: 85 },
  '.jpeg': { type: 'jpeg', quality: 85 },
  '.png': { type: 'png' },
};

function selectTargets(ids) {
  const live = projects.filter((p) => p.status === 'live' && p.thumbnail);
  if (ids.length === 0) return live;
  const byId = new Map(live.map((p) => [p.id, p]));
  const unknown = ids.filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown or non-live project id(s): ${unknown.join(', ')}. ` +
        `Known: ${[...byId.keys()].join(', ')}`,
    );
  }
  return ids.map((id) => byId.get(id));
}

async function capture(context, project) {
  const url = `${BASE_URL}/projects/${project.id}`;
  const outFile = path.join(PUBLIC_DIR, project.thumbnail.replace(/^\/+/, ''));
  const format = FORMAT_BY_EXT[path.extname(outFile).toLowerCase()];
  if (!format) {
    throw new Error(`unsupported thumbnail extension in "${project.thumbnail}" (use .jpg or .png)`);
  }
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  try {
    await page.goto(url, { waitUntil: 'load' });

    // Wait until the remote rendered into the stage — or the host reported a failure.
    await page.locator('.stage__mount > *, .stage__error').first().waitFor({ state: 'attached' });
    const error = page.locator('.stage__error');
    if ((await error.count()) > 0) {
      throw new Error(`host could not load the remote:\n  ${(await error.innerText()).trim()}`);
    }

    // Injected after hydration so React never meets an unexpected <style> in <head>.
    await page.addStyleTag({ content: HIDE_HOST_CHROME_CSS });

    // Let webfonts, video first frames and entrance animations settle.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page
      .waitForFunction(
        () => [...document.querySelectorAll('video')].every((v) => v.readyState >= 2),
        undefined,
        { timeout: 10_000 },
      )
      .catch(() => {});
    await page.waitForTimeout(SETTLE_MS);

    // Guard the one hard requirement: no "← Projects" button in the capture.
    const backVisible = await page
      .locator('.stage__back')
      .evaluateAll((els) => els.some((el) => getComputedStyle(el).display !== 'none'));
    if (backVisible) throw new Error('.stage__back is still visible; refusing to capture');

    await mkdir(path.dirname(outFile), { recursive: true });
    await page.screenshot({ path: outFile, ...format });
    return outFile;
  } finally {
    await page.close();
  }
}

async function main() {
  const targets = selectTargets(process.argv.slice(2));
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  });
  const failed = [];
  try {
    // Sequential on purpose: parallel pages fight for CPU and stutter the animations.
    for (const project of targets) {
      process.stdout.write(`▸ ${project.id} … `);
      try {
        const file = await capture(context, project);
        console.log(`saved ${path.relative(process.cwd(), file)}`);
      } catch (err) {
        failed.push(project.id);
        console.log('FAILED');
        console.error(`  ${err instanceof Error ? err.message : err}`);
      }
    }
  } finally {
    await browser.close();
  }
  if (failed.length > 0) {
    console.error(`\n${failed.length} thumbnail(s) failed: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
