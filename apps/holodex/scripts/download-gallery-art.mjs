/**
 * Copies the effects page's first-screen art from TCGdex into
 * `public/gallery/<card id>.webp`, so the landing page serves it from this
 * remote's own origin (src/lib/gallery-art.ts).
 *
 * The effects page opens on its first section, and its three cards are the
 * page's largest content, so the moment the first of them paints is its LCP.
 * Straight from assets.tcgdex.net that took a new connection to a server with
 * no CDN in front of it (~0.9 s on a desktop profile); here it is one more
 * file from the origin that serves the remote. Every other tile still loads
 * TCGdex's own file, and so does this one if its copy is missing (CardImage
 * moves on to the next file on an error).
 *
 * - Idempotent: a copy that exists is kept.
 * - Best-effort: a failed download warns and never fails the build.
 * - Defensive: only the fixed id -> URL pairs below are written, and only a
 *   body that is a WebP of sane size.
 *
 * The list is the first section of src/holo/effect-gallery.ts, each URL its
 * card's captured image base plus `/low.webp` (a test checks both).
 */
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(projectRoot, 'public', 'gallery');

/** A card's low-res art is 10-30 KB; anything far bigger is not the image we asked for. */
const MAX_ART_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

export const FIRST_SECTION_ART = [
  { id: 'sm1-1', url: 'https://assets.tcgdex.net/en/sm/sm1/1/low.webp' },
  { id: 'det1-1', url: 'https://assets.tcgdex.net/en/sm/det1/1/low.webp' },
  { id: 'sm7-1', url: 'https://assets.tcgdex.net/en/sm/sm7/1/low.webp' },
];

/**
 * Throws unless `bytes` looks like a WebP that fits the size limit.
 * @param {Buffer} bytes downloaded body
 * @param {{ maxBytes?: number }} [options]
 */
export function assertWebpPayload(bytes, { maxBytes = MAX_ART_BYTES } = {}) {
  if (bytes.length > maxBytes) {
    throw new Error(`payload too large (${bytes.length} bytes, limit ${maxBytes})`);
  }
  const riff = bytes.subarray(0, 4).toString('latin1');
  const webp = bytes.subarray(8, 12).toString('latin1');
  if (riff !== 'RIFF' || webp !== 'WEBP') throw new Error('payload is not a WebP');
}

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
  let saved = 0;
  let cached = 0;
  let failed = 0;
  for (const { id, url } of FIRST_SECTION_ART) {
    const dest = join(outDir, `${id}.webp`);
    if (await exists(dest)) {
      cached += 1;
      continue;
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      assertWebpPayload(bytes);
      await writeFile(dest, bytes);
      saved += 1;
      console.log(`  saved    ${id}.webp  (${bytes.length.toLocaleString()} bytes)`);
    } catch (error) {
      failed += 1;
      console.warn(`  FAILED   ${id}.webp  (${error instanceof Error ? error.message : error})`);
    }
  }
  console.log(
    `gallery art: ${saved} downloaded, ${cached} cached, ${failed} failed -> public/gallery/`,
  );
}

// Run only when executed directly (not when imported by the tests), and
// never break the build over it: the page falls back to TCGdex's own files.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.warn('gallery art skipped:', error instanceof Error ? error.message : error);
  });
}
