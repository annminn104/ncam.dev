import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EFFECT_GALLERY } from '../src/holo/effect-gallery';
import { CAPTURED_CARDS } from '../src/holo/effect-gallery.cards';
import { cardImageBase } from '../src/lib/images';
import {
  ART_HOST,
  FIRST_SECTION_ART,
  artPath,
  artUrl,
  assertWebpPayload,
  assertWebpResponse,
  readCapped,
} from './download-gallery-art.mjs';

const webp = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.alloc(4),
  Buffer.from('WEBP', 'latin1'),
  Buffer.alloc(16),
]);

const webpResponse = (headers: Record<string, string> = {}, status = 200) =>
  new Response(webp, { status, headers: { 'content-type': 'image/webp', ...headers } });

describe('FIRST_SECTION_ART', () => {
  it('copies the first section’s cards, each from its captured image base', () => {
    const [first] = EFFECT_GALLERY;
    expect(FIRST_SECTION_ART.map(({ id }) => id)).toEqual([...first!.cardIds]);
    for (const { id, url } of FIRST_SECTION_ART) {
      expect(url).toBe(`${cardImageBase(CAPTURED_CARDS[id]!)}/low.webp`);
    }
  });

  it('names only URLs and files the script accepts', () => {
    for (const { id, url } of FIRST_SECTION_ART) {
      expect(artUrl(url).host).toBe(ART_HOST);
      expect(() => artPath(id)).not.toThrow();
    }
  });
});

describe('artUrl', () => {
  it('accepts https on TCGdex’s asset host', () => {
    expect(artUrl('https://assets.tcgdex.net/en/sm/sm1/1/low.webp').pathname).toBe(
      '/en/sm/sm1/1/low.webp',
    );
  });

  it.each([
    'http://assets.tcgdex.net/en/sm/sm1/1/low.webp',
    'https://assets.tcgdex.net.example.com/en/sm/sm1/1/low.webp',
    'https://example.com/assets.tcgdex.net/low.webp',
    'https://api.tcgdex.net/v2/en/cards/sm1-1',
    'https://assets.tcgdex.net:8443/en/sm/sm1/1/low.webp',
    'https://user:secret@assets.tcgdex.net/en/sm/sm1/1/low.webp',
    'file:///etc/passwd',
  ])('rejects %s', (url) => {
    expect(() => artUrl(url)).toThrow(/not an https URL/);
  });
});

describe('artPath', () => {
  const dir = join('/tmp', 'gallery');

  it('puts a card id’s copy directly inside the folder', () => {
    expect(artPath('sm1-1', dir)).toBe(resolve(dir, 'sm1-1.webp'));
    expect(artPath('swsh12.5gg-GG01', dir)).toBe(resolve(dir, 'swsh12.5gg-GG01.webp'));
  });

  it.each(['', '../sm1-1', 'a/b', 'a\\b', '..', '.hidden', 'sm1..1', 'sm1-1 ', 'sm1-1\0'])(
    'rejects %j',
    (id) => {
      expect(() => artPath(id, dir)).toThrow(/not a card id/);
    },
  );
});

describe('assertWebpResponse', () => {
  it('accepts a WebP response, its headers sent once or twice', () => {
    expect(() => assertWebpResponse(webpResponse())).not.toThrow();
    expect(() =>
      assertWebpResponse(webpResponse({ 'content-type': 'image/webp, image/webp' })),
    ).not.toThrow();
    expect(() =>
      assertWebpResponse(webpResponse({ 'content-length': String(webp.length) })),
    ).not.toThrow();
  });

  it('rejects an error status', () => {
    expect(() => assertWebpResponse(webpResponse({}, 404))).toThrow(/HTTP 404/);
  });

  it('rejects a body that does not say it is a WebP, such as TCGdex’s 404 page', () => {
    expect(() =>
      assertWebpResponse(webpResponse({ 'content-type': 'text/html, image/webp' })),
    ).toThrow(/not a WebP/);
    expect(() => assertWebpResponse(webpResponse({ 'content-type': 'image/png' }))).toThrow(
      /not a WebP/,
    );
  });

  it('rejects a declared length over the limit', () => {
    const response = webpResponse({ 'content-length': String(webp.length) });
    expect(() => assertWebpResponse(response, { maxBytes: webp.length - 1 })).toThrow(/too large/);
  });
});

describe('readCapped', () => {
  it('reads a body within the limit', async () => {
    expect(await readCapped(webpResponse(), { maxBytes: webp.length })).toEqual(webp);
  });

  it('stops reading a body over the limit', async () => {
    await expect(readCapped(webpResponse(), { maxBytes: webp.length - 1 })).rejects.toThrow(
      /too large/,
    );
  });
});

describe('assertWebpPayload', () => {
  it('accepts a WebP payload', () => {
    expect(() => assertWebpPayload(webp)).not.toThrow();
  });

  it('rejects a payload that is not a WebP, such as an HTML error page', () => {
    const html = Buffer.from('<!doctype html><html><body>moved</body></html>');
    expect(() => assertWebpPayload(html)).toThrow(/not a WebP/);
  });

  it('rejects a payload larger than the size limit', () => {
    expect(() => assertWebpPayload(webp, { maxBytes: webp.length - 1 })).toThrow(/too large/);
  });
});
