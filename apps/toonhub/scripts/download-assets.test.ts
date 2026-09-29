import { describe, expect, it } from 'vitest';
import { FIGURINE_FORMATS as HERO_FORMATS, FIGURINE_WIDTHS as HERO_WIDTHS } from '../src/figurines';
import {
  FIGURINE_FORMATS,
  FIGURINE_WIDTHS,
  assertPngPayload,
  derivedTargets,
} from './download-assets.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(16)]);

describe('assertPngPayload', () => {
  it('accepts a PNG payload', () => {
    expect(() => assertPngPayload(png)).not.toThrow();
  });

  it('rejects a payload that is not a PNG, such as an HTML error page', () => {
    const html = Buffer.from('<!doctype html><html><body>moved</body></html>');
    expect(() => assertPngPayload(html)).toThrow(/not a PNG/);
  });

  it('rejects a payload larger than the size limit', () => {
    expect(() => assertPngPayload(png, { maxBytes: png.length - 1 })).toThrow(/too large/);
  });
});

describe('derivedTargets', () => {
  it('names one file per published width and format', () => {
    const targets = derivedTargets('01.png');
    expect(targets).toHaveLength(FIGURINE_WIDTHS.length * FIGURINE_FORMATS.length);
    expect(targets).toContainEqual({ width: 240, format: 'avif', file: '01-240.avif' });
    expect(targets).toContainEqual({ width: 1920, format: 'webp', file: '01-1920.webp' });
  });

  it('derives exactly the widths and formats the hero offers in its srcsets', () => {
    expect(FIGURINE_WIDTHS).toEqual([...HERO_WIDTHS]);
    expect(FIGURINE_FORMATS).toEqual([...HERO_FORMATS]);
  });
});
