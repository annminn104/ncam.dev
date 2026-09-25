/**
 * Holodex's own route to TCGdex's card art, for the one consumer that needs
 * CORS: a card's WebGL texture (holo/scene.ts), which must be loaded with
 * `crossOrigin`. TCGdex's asset CDN answers every request with two
 * `Access-Control-Allow-Origin: *` headers (a doubled Cache-Control too, and
 * a missing file comes back typed `text/html, image/webp`), and a browser
 * refuses a doubled Allow-Origin outright: from 2026-09-25, when it began,
 * no card drew its foil (holo.unavailable). A plain `<img>` asks without CORS
 * and is unaffected, so every CardImage still loads straight from TCGdex.
 *
 * The route answers `GET /api/tcgdex-asset?path=<path under
 * assets.tcgdex.net>` with the file and headers of its own, never TCGdex's.
 * The Vite dev and preview servers serve it (vite.config.ts) and, deployed,
 * the Vercel Function api/tcgdex-asset.ts, both through handleAssetProxy.
 */

export const TCGDEX_ASSETS = 'https://assets.tcgdex.net/';

/** The route, at the root of Holodex's own origin: the Function's path. */
export const ASSET_PROXY_ROUTE = '/api/tcgdex-asset';

/**
 * A path the route will fetch: a language (`en`, `zh-tw`), then segments
 * that each start with a letter or a digit, so never `.` or `..`, ending in
 * an image's extension. TCGdex's own paths hold dots (`sv03.5`), hyphens
 * (`30th-c`) and capitals (`TG23`); nothing else gets through, so the
 * upstream URL can only ever be a TCGdex image.
 */
const ASSET_PATH = /^[a-z]{2}(?:-[a-z]{2})?(?:\/[A-Za-z0-9][\w.-]*)+\.(webp|png|jpg)$/;

/** Typed by the path's extension, never by TCGdex's header. */
const CONTENT_TYPE: Readonly<Record<string, string>> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
};

/**
 * On every answer, the errors included, so a failed load reads as its status
 * rather than as a CORS error. Resource-Policy lets a page that isolates
 * itself (COEP) still take the file.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

/** TCGdex's own policy for its files, which never change under one URL. */
const CACHE_FILE = 'public, max-age=31536000, s-maxage=31536000, immutable';
/** A missing file may yet appear, so it is only remembered for an hour. */
const CACHE_MISSING = 'public, max-age=3600, s-maxage=3600';

function empty(status: number, headers: Record<string, string>): Response {
  return new Response(null, { status, headers: { ...CORS, ...headers } });
}

/**
 * Answers one request to the route: the file TCGdex holds at `?path=`, or
 * 400 for a path the route will not fetch, 404 for a file TCGdex does not
 * have, 405 for a method other than GET or HEAD, and 502 when TCGdex cannot
 * be reached or fails. TCGdex is asked with nothing of the visitor's request,
 * no Origin and no cookie: the file is the same for everyone.
 */
export async function handleAssetProxy(
  request: Request,
  fetchAsset: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return empty(405, { Allow: 'GET, HEAD' });
  }
  const path = new URL(request.url).searchParams.get('path') ?? '';
  const format = ASSET_PATH.exec(path)?.[1];
  if (!format) return empty(400, { 'Cache-Control': 'no-store' });

  let body: ArrayBuffer;
  try {
    const upstream = await fetchAsset(TCGDEX_ASSETS + path);
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return upstream.status === 404
        ? empty(404, { 'Cache-Control': CACHE_MISSING })
        : empty(502, { 'Cache-Control': 'no-store' });
    }
    body = await upstream.arrayBuffer();
  } catch {
    return empty(502, { 'Cache-Control': 'no-store' });
  }
  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': CONTENT_TYPE[format],
      'Content-Length': String(body.byteLength),
      'Cache-Control': CACHE_FILE,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * The route's URL for a TCGdex asset, at the root of `origin`, Holodex's
 * own (hosted, the page is the portfolio's, on another origin), or null for
 * a URL the route would refuse.
 */
export function proxiedAssetUrl(url: string, origin: string | URL): string | null {
  if (!url.startsWith(TCGDEX_ASSETS)) return null;
  const path = url.slice(TCGDEX_ASSETS.length);
  if (!ASSET_PATH.test(path)) return null;
  const proxied = new URL(ASSET_PROXY_ROUTE, origin);
  proxied.searchParams.set('path', path);
  return proxied.href;
}

/**
 * Where a card's texture is asked for, in order: each of its files (`urls`,
 * the WebP then the PNG: lib/images.ts#imageUrls) through the route, then
 * each straight from TCGdex, which draws again should TCGdex fix its headers
 * or the route be missing (a static host without the Function). The route
 * takes every format before TCGdex takes any, as a card whose WebP is missing
 * is the failure that happens, and TCGdex itself is refused for now.
 */
export function textureUrls(urls: readonly string[], origin: string | URL): string[] {
  return [...urls.flatMap((url) => proxiedAssetUrl(url, origin) ?? []), ...urls];
}

/** What the first of `urls` that loads gives, or the last failure if none loads. */
export async function firstLoaded<T>(
  urls: readonly string[],
  load: (url: string) => Promise<T>,
): Promise<T> {
  let failure: unknown = new Error('no URL to load');
  for (const url of urls) {
    try {
      return await load(url);
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}
