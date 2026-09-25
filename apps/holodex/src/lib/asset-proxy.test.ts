import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  ASSET_PROXY_ROUTE,
  TCGDEX_ASSETS,
  firstLoaded,
  handleAssetProxy,
  proxiedAssetUrl,
  textureUrls,
} from './asset-proxy';
import { imageUrls } from './images';

const HOLODEX = 'https://holodex.example/';
const ART = 'en/swsh/swsh1/14/high.webp';

/** A request to the route, as the texture loader makes it. */
function ask(path: string | null, init: RequestInit = {}): Request {
  const url = new URL(ASSET_PROXY_ROUTE, HOLODEX);
  if (path !== null) url.searchParams.set('path', path);
  return new Request(url, init);
}

/**
 * TCGdex's answer as its CDN sent it on 2026-09-25: Allow-Origin and
 * Cache-Control each twice, which a Headers object joins into one value.
 */
function tcgdex(body: BodyInit | null, status = 200, contentType = 'image/webp'): Response {
  return new Response(body, {
    status,
    headers: [
      ['Access-Control-Allow-Origin', '*'],
      ['Access-Control-Allow-Origin', '*'],
      ['Cache-Control', 'max-age=31536000, public'],
      ['Cache-Control', 'max-age=31536000, immutable'],
      ['Content-Type', contentType],
    ],
  });
}

const serving = (response: Response | Error) =>
  vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });

describe('handleAssetProxy', () => {
  it('fetches the file from TCGdex, and nothing of the visitor’s request', async () => {
    const fetchAsset = serving(tcgdex('bytes'));
    await handleAssetProxy(
      ask(ART, { headers: { Origin: 'https://portfolio.example' } }),
      fetchAsset,
    );
    // One argument: no Origin, no cookie, no header of the visitor's reaches TCGdex.
    expect(fetchAsset.mock.calls).toEqual([[`${TCGDEX_ASSETS}${ART}`]]);
  });

  it('answers with the file under headers of its own, one Allow-Origin among them', async () => {
    const response = await handleAssetProxy(ask(ART), serving(tcgdex('webp bytes')));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('webp bytes');
    expect(Object.fromEntries(response.headers)).toEqual({
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
      'content-type': 'image/webp',
      'content-length': '10',
      'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'x-content-type-options': 'nosniff',
    });
  });

  it('types the file by its extension, whatever TCGdex says it is', async () => {
    // A missing file comes back `text/html, image/webp`; a found one must
    // never be served as HTML from Holodex's own origin.
    const png = await handleAssetProxy(
      ask('en/swsh/swsh1/14/high.png'),
      serving(tcgdex('png', 200, 'text/html, image/png')),
    );
    expect(png.headers.get('content-type')).toBe('image/png');
    const jpg = await handleAssetProxy(ask('en/base/base1/4/high.jpg'), serving(tcgdex('jpg')));
    expect(jpg.headers.get('content-type')).toBe('image/jpeg');
  });

  it('answers a HEAD with the headers alone', async () => {
    const response = await handleAssetProxy(ask(ART, { method: 'HEAD' }), serving(tcgdex('12345')));
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(response.headers.get('content-length')).toBe('5');
  });

  it('passes a missing file on as a 404, briefly cached, with its Allow-Origin', async () => {
    const response = await handleAssetProxy(
      ask('en/swsh/swsh1/99999/high.webp'),
      serving(tcgdex('<html>', 404, 'text/html, image/webp')),
    );
    expect(response.status).toBe(404);
    expect(response.body).toBeNull();
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=3600');
  });

  it('answers 502, never cached, when TCGdex fails or cannot be reached', async () => {
    for (const fetchAsset of [
      serving(tcgdex('oops', 503)),
      serving(new TypeError('fetch failed')),
    ]) {
      const response = await handleAssetProxy(ask(ART), fetchAsset);
      expect(response.status).toBe(502);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    }
  });

  it('refuses, without asking TCGdex, any path that is not a TCGdex image', async () => {
    for (const path of [
      null,
      '',
      'https://evil.example/x.webp',
      '//evil.example/x.webp',
      'en/../../etc/x.webp',
      'en/./swsh/x.webp',
      'en/swsh/swsh1/14/high.svg',
      'en/swsh/swsh1/14/high.html',
      'en/swsh/swsh1/14/high.webp?x=1',
      'en/swsh/swsh1/14/high.webp#x',
      'en\\swsh\\x.webp',
      'en/swsh/swsh1/14',
      'english/swsh/x.webp',
    ]) {
      const fetchAsset = serving(tcgdex('bytes'));
      const response = await handleAssetProxy(ask(path), fetchAsset);
      expect(response.status, String(path)).toBe(400);
      expect(fetchAsset).not.toHaveBeenCalled();
    }
  });

  it('allows GET and HEAD only', async () => {
    const fetchAsset = serving(tcgdex('bytes'));
    const response = await handleAssetProxy(ask(ART, { method: 'POST', body: 'x' }), fetchAsset);
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
    expect(fetchAsset).not.toHaveBeenCalled();
  });
});

describe('proxiedAssetUrl', () => {
  it('asks the route at the root of Holodex’s own origin', () => {
    expect(proxiedAssetUrl(TCGDEX_ASSETS + ART, HOLODEX)).toBe(
      'https://holodex.example/api/tcgdex-asset?path=en%2Fswsh%2Fswsh1%2F14%2Fhigh.webp',
    );
    // Wherever the build's base is, the Function answers at the root.
    expect(proxiedAssetUrl(TCGDEX_ASSETS + ART, 'https://cdn.example/holodex/')).toBe(
      'https://cdn.example/api/tcgdex-asset?path=en%2Fswsh%2Fswsh1%2F14%2Fhigh.webp',
    );
  });

  it('keeps the dots, hyphens and capitals of TCGdex’s own paths', () => {
    for (const path of [
      'en/sv/sv03.5/026/high.webp',
      'en/me/30th-c/001/high.png',
      'en/swsh/swsh12/TG23/high.webp',
    ]) {
      const proxied = proxiedAssetUrl(TCGDEX_ASSETS + path, HOLODEX);
      expect(new URL(proxied ?? '').searchParams.get('path')).toBe(path);
    }
  });

  it('proxies nothing but the images the route would fetch', () => {
    expect(proxiedAssetUrl('https://example.com/en/swsh/swsh1/14/high.webp', HOLODEX)).toBeNull();
    expect(
      proxiedAssetUrl('http://assets.tcgdex.net/en/swsh/swsh1/14/high.webp', HOLODEX),
    ).toBeNull();
    expect(proxiedAssetUrl(`${TCGDEX_ASSETS}en/swsh/swsh1/14/high.html`, HOLODEX)).toBeNull();
    expect(proxiedAssetUrl(`${TCGDEX_ASSETS}en/../x.webp`, HOLODEX)).toBeNull();
  });

  it('asks the route the handler answers: every URL it builds is one the handler serves', async () => {
    const proxied = proxiedAssetUrl(TCGDEX_ASSETS + ART, HOLODEX) ?? '';
    const fetchAsset = serving(tcgdex('bytes'));
    const response = await handleAssetProxy(new Request(proxied), fetchAsset);
    expect(response.status).toBe(200);
    expect(fetchAsset.mock.calls).toEqual([[TCGDEX_ASSETS + ART]]);
  });

  it('names the route after the Vercel Function that serves it deployed', () => {
    // Vercel routes /api/<name> to api/<name>.ts.
    expect(ASSET_PROXY_ROUTE.startsWith('/api/')).toBe(true);
    expect(existsSync(new URL(`../../${ASSET_PROXY_ROUTE.slice(1)}.ts`, import.meta.url))).toBe(
      true,
    );
  });
});

describe('textureUrls', () => {
  // A card's files as HoloCard hands them over: imageUrls(base, 'high').
  const files = imageUrls(`${TCGDEX_ASSETS}en/swsh/swsh1/14`, 'high');
  const [webp, png] = files;

  it('asks the route for the WebP, then the PNG, before TCGdex itself for either', () => {
    // The route before TCGdex for every format: a missing WebP is the failure
    // that happens, and TCGdex's own answers are refused for now.
    expect(textureUrls(files, HOLODEX)).toEqual([
      proxiedAssetUrl(webp, HOLODEX),
      proxiedAssetUrl(png, HOLODEX),
      webp,
      png,
    ]);
    expect(webp.endsWith('/high.webp') && png.endsWith('/high.png')).toBe(true);
  });

  it('asks for any other URL as it is, and for nothing without a file', () => {
    expect(textureUrls(['https://example.com/card.webp'], HOLODEX)).toEqual([
      'https://example.com/card.webp',
    ]);
    expect(textureUrls([], HOLODEX)).toEqual([]);
  });
});

describe('firstLoaded', () => {
  it('gives what the first URL that loads gives, and asks for no more', async () => {
    const load = vi.fn(async (url: string) => {
      if (url === 'a') throw new Error('a failed');
      return `loaded ${url}`;
    });
    expect(await firstLoaded(['a', 'b', 'c'], load)).toBe('loaded b');
    expect(load.mock.calls).toEqual([['a'], ['b']]);
  });

  it('throws the last failure when none loads', async () => {
    const load = async (url: string): Promise<string> => {
      throw new Error(`${url} failed`);
    };
    await expect(firstLoaded(['a', 'b'], load)).rejects.toThrow('b failed');
    await expect(firstLoaded([], load)).rejects.toThrow('no URL to load');
  });
});
