import { describe, expect, it } from 'vitest';
import { parseCapture } from './capture';

describe('parseCapture', () => {
  it('reads the two poster shapes', () => {
    expect(parseCapture('?capture=landscape')).toBe('landscape');
    expect(parseCapture('?capture=portrait')).toBe('portrait');
  });

  it('is off without a known shape', () => {
    expect(parseCapture('')).toBeNull();
    expect(parseCapture('?capture')).toBeNull();
    expect(parseCapture('?capture=square')).toBeNull();
    expect(parseCapture('?other=landscape')).toBeNull();
  });
});
