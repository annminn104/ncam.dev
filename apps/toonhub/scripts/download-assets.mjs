/**
 * Downloads the TOONHUB figurine images into `public/figurines/` so the site
 * can self-host them instead of hot-linking the remote source.
 *
 * - Idempotent: files that already exist are skipped.
 * - Best-effort: never fails the build. If a download fails (offline, source
 *   moved, etc.) it warns and exits 0 so `dev` / `build` still run. Re-run any
 *   time with `npm run assets`.
 *
 * Source of truth for the original URLs lives here.
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(projectRoot, 'public', 'figurines');

const ASSETS = [
  {
    file: '01.png',
    url: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/1.02464a56.png',
  },
  {
    file: '02.png',
    url: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/2.b977faab.png',
  },
  {
    file: '03.png',
    url: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/3.4df853b4.png',
  },
  {
    file: '04.png',
    url: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/4.4457fbce.png',
  },
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const { file, url } of ASSETS) {
    const dest = join(outDir, file);
    if (await exists(dest)) {
      skipped += 1;
      console.log(`  cached   ${file}`);
      continue;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      await writeFile(dest, bytes);
      downloaded += 1;
      console.log(`  saved    ${file}  (${bytes.length.toLocaleString()} bytes)`);
    } catch (error) {
      failed += 1;
      console.warn(`  FAILED   ${file}  (${error instanceof Error ? error.message : error})`);
    }
  }

  console.log(
    `\nfigurine assets: ${downloaded} downloaded, ${skipped} cached, ${failed} failed -> public/figurines/`,
  );
  if (failed > 0) {
    console.warn(
      'Some assets could not be fetched. Re-run `npm run assets` when online, or add the files manually.',
    );
  }
}

// Never break the build because of assets.
main().catch((error) => {
  console.warn('asset download skipped:', error instanceof Error ? error.message : error);
});
