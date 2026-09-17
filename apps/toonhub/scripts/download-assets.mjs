/**
 * Downloads the TOONHUB figurine images into `public/figurines/` so the site
 * can self-host them instead of hot-linking the remote source.
 *
 * - Idempotent: files that already exist are skipped.
 * - Best-effort: never fails the build. If a download fails (offline, source
 *   moved, etc.) it warns and exits 0 so `dev` / `build` still run. Re-run any
 *   time with `npm run assets`.
 * - Defensive: only the fixed URL -> file pairs below are ever written, and a body
 *   is written only if it is a PNG of sane size. `public/` is served verbatim, so a
 *   redirect to an HTML page or a swapped payload must not end up there.
 *
 * Source of truth for the original URLs lives here.
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(projectRoot, 'public', 'figurines');

/** The real figurines are 5-7 MB each; anything far bigger is not the image we asked for. */
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Throws unless `bytes` looks like a PNG that fits the size limit.
 * @param {Buffer} bytes downloaded body
 * @param {{ maxBytes?: number }} [options]
 */
export function assertPngPayload(bytes, { maxBytes = MAX_ASSET_BYTES } = {}) {
  if (bytes.length > maxBytes) {
    throw new Error(`payload too large (${bytes.length} bytes, limit ${maxBytes})`);
  }
  const head = bytes.subarray(0, PNG_SIGNATURE.length);
  if (!head.equals(PNG_SIGNATURE)) {
    throw new Error('payload is not a PNG');
  }
}

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
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      assertPngPayload(bytes);
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

// Run only when executed directly (not when imported by the tests).
// Never break the build because of assets.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.warn('asset download skipped:', error instanceof Error ? error.message : error);
  });
}
