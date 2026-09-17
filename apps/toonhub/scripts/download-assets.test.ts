import { describe, expect, it } from 'vitest';
import { assertPngPayload } from './download-assets.mjs';

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
