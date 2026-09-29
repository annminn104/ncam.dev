/**
 * The TOONHUB figurine images, in two steps:
 *
 * 1. Downloads the PNG sources (2160x2880, 5-7 MB each) into `assets/figurines/`,
 *    where they are committed, so the site self-hosts them instead of
 *    hot-linking the remote source.
 *    - Idempotent: files that already exist are skipped.
 *    - Best-effort: a failed download (offline, source moved, etc.) warns and
 *      moves on. Re-run any time with `pnpm assets`.
 *    - Defensive: only the fixed URL -> file pairs below are ever written, and a
 *      body is written only if it is a PNG of sane size, so a redirect to an
 *      HTML page or a swapped payload never becomes a source.
 * 2. Derives what the page serves from them: `public/figurines/<name>-<width>.avif`
 *    and `.webp` for every width in FIGURINE_WIDTHS (src/figurines.ts: the
 *    hero offers exactly those in its srcsets), 8-260 KB each where the PNG
 *    was megabytes. Skipped while newer than its source; a source that cannot
 *    be converted fails the run, because the page would ship without it.
 *
 * Source of truth for the original URLs lives here.
 */
import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(projectRoot, 'assets', 'figurines');
const outDir = join(projectRoot, 'public', 'figurines');

/** Keep equal to src/figurines.ts (a test checks). */
export const FIGURINE_WIDTHS = [240, 480, 720, 960, 1440, 1920];
export const FIGURINE_FORMATS = ['avif', 'webp'];
/** Encoder settings per format: visually alike, AVIF ~40% smaller. */
const ENCODE = {
  avif: { quality: 45, effort: 4 },
  webp: { quality: 75, effort: 5 },
};

/**
 * The files derived from one source, `01.png` -> `01-240.avif`, `01-240.webp`, … .
 * @param {string} file source file name
 */
export function derivedTargets(file) {
  const name = file.replace(/\.png$/, '');
  return FIGURINE_WIDTHS.flatMap((width) =>
    FIGURINE_FORMATS.map((format) => ({ width, format, file: `${name}-${width}.${format}` })),
  );
}

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
  await mkdir(sourceDir, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const { file, url } of ASSETS) {
    const dest = join(sourceDir, file);
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
    `\nfigurine sources: ${downloaded} downloaded, ${skipped} cached, ${failed} failed -> assets/figurines/`,
  );
  if (failed > 0) {
    console.warn(
      'Some sources could not be fetched. Re-run `pnpm assets` when online, or add the files manually.',
    );
  }
  await deriveImages();
}

async function mtime(path) {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return -1;
  }
}

/** Step 2: every AVIF and WebP the page serves, from each source present. */
async function deriveImages() {
  await mkdir(outDir, { recursive: true });
  const { default: sharp } = await import('sharp');
  let written = 0;
  let current = 0;
  for (const { file } of ASSETS) {
    const source = join(sourceDir, file);
    const sourceTime = await mtime(source);
    if (sourceTime < 0) {
      console.warn(`  MISSING  ${file}  (no source, so no derived images)`);
      process.exitCode = 1;
      continue;
    }
    for (const { width, format, file: target } of derivedTargets(file)) {
      const dest = join(outDir, target);
      if ((await mtime(dest)) > sourceTime) {
        current += 1;
        continue;
      }
      const info = await sharp(source).resize({ width })[format](ENCODE[format]).toFile(dest);
      written += 1;
      console.log(`  derived  ${target}  (${info.size.toLocaleString()} bytes)`);
    }
  }
  console.log(`figurine images: ${written} written, ${current} current -> public/figurines/`);
}

// Run only when executed directly (not when imported by the tests). A failed
// download never breaks the build (the sources are committed); an image that
// cannot be made does, since the page would ship without that figurine.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('figurine images failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
