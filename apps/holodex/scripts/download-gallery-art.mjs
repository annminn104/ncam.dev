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
 * - Defensive: only the fixed id -> URL pairs below are fetched and written.
 *   Each URL must be https on TCGdex's asset host (no redirect followed), each
 *   response must say it is a WebP no larger than the limit and is read no
 *   further than that, the bytes must be a WebP, and each file is named from an
 *   id checked to be a plain card id, inside public/gallery/.
 *
 * The list is the first section of src/holo/effect-gallery.ts, each URL its
 * card's captured image base plus `/low.webp` (a test checks both).
 */
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(projectRoot, 'public', 'gallery');

/** The one host the art comes from: TCGdex's asset server. */
export const ART_HOST = 'assets.tcgdex.net';
/** A card's low-res art is 10-30 KB; anything far bigger is not the image we asked for. */
const MAX_ART_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 30_000;
/** A TCGdex card id (`sm1-1`, `swsh12.5gg-GG01`): letters and digits, joined by dots or dashes. */
const CARD_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i;

export const FIRST_SECTION_ART = [
  { id: 'sm1-1', url: 'https://assets.tcgdex.net/en/sm/sm1/1/low.webp' },
  { id: 'det1-1', url: 'https://assets.tcgdex.net/en/sm/det1/1/low.webp' },
  { id: 'sm7-1', url: 'https://assets.tcgdex.net/en/sm/sm7/1/low.webp' },
];

/**
 * The art's URL, parsed, or a throw unless it is https on {@link ART_HOST}.
 * @param {string} url
 */
export function artUrl(url) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    parsed.host !== ART_HOST ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    throw new Error(`not an https URL on ${ART_HOST}: ${url}`);
  }
  return parsed;
}

/**
 * Where a card's copy goes, `<dir>/<id>.webp`, or a throw unless `id` is a
 * plain card id, which keeps the file directly inside `dir`.
 * @param {string} id
 * @param {string} [dir]
 */
export function artPath(id, dir = outDir) {
  if (!CARD_ID.test(id)) throw new Error(`not a card id: ${JSON.stringify(id)}`);
  const root = resolve(dir);
  const path = resolve(root, `${id}.webp`);
  if (dirname(path) !== root) throw new Error(`${id}.webp would leave ${root}`);
  return path;
}

/**
 * Throws unless the response is a 2xx that says it is a WebP no larger than
 * the limit. TCGdex's server sends some headers twice, which fetch joins with
 * a comma, so every value must say so (its 404 page is `text/html, image/webp`).
 * @param {Response} response
 * @param {{ maxBytes?: number }} [options]
 */
export function assertWebpResponse(response, { maxBytes = MAX_ART_BYTES } = {}) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  const types = type.split(',').map((value) => value.split(';')[0].trim().toLowerCase());
  if (!types.every((value) => value === 'image/webp')) {
    throw new Error(`not a WebP (content-type ${JSON.stringify(type)})`);
  }
  const lengths = (response.headers.get('content-length') ?? '').split(',').map(Number);
  if (lengths.some((length) => length > maxBytes)) {
    throw new Error(`payload too large (content-length ${lengths.join(', ')}, limit ${maxBytes})`);
  }
}

/**
 * The response's body, read up to `maxBytes` and no further: a longer body
 * throws before it is held in full.
 * @param {Response} response
 * @param {{ maxBytes?: number }} [options]
 */
export async function readCapped(response, { maxBytes = MAX_ART_BYTES } = {}) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks);
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`payload too large (over ${maxBytes} bytes)`);
    }
    chunks.push(value);
  }
}

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
    try {
      const dest = artPath(id);
      if (await exists(dest)) {
        cached += 1;
        continue;
      }
      const res = await fetch(artUrl(url), {
        redirect: 'error',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      assertWebpResponse(res);
      const bytes = await readCapped(res);
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
