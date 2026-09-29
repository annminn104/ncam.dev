import { describe, expect, it } from 'vitest';
import { EFFECT_GALLERY } from '../src/holo/effect-gallery';
import { CAPTURED_CARDS } from '../src/holo/effect-gallery.cards';
import { cardImageBase } from '../src/lib/images';
import { FIRST_SECTION_ART, assertWebpPayload } from './download-gallery-art.mjs';

const webp = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.alloc(4),
  Buffer.from('WEBP', 'latin1'),
  Buffer.alloc(16),
]);

describe('FIRST_SECTION_ART', () => {
  it('copies the first section’s cards, each from its captured image base', () => {
    const [first] = EFFECT_GALLERY;
    expect(FIRST_SECTION_ART.map(({ id }) => id)).toEqual([...first!.cardIds]);
    for (const { id, url } of FIRST_SECTION_ART) {
      expect(url).toBe(`${cardImageBase(CAPTURED_CARDS[id]!)}/low.webp`);
    }
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
