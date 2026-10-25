import { describe, expect, it } from 'vitest';
import { parseCapture, POSTER_SEARCH } from './capture';

describe('parseCapture', () => {
  it('reads the two poster shapes and nothing else', () => {
    expect(parseCapture('?capture=landscape')).toBe('landscape');
    expect(parseCapture('?capture=portrait&x=1')).toBe('portrait');
    expect(parseCapture('?capture=square')).toBeNull();
    expect(parseCapture('')).toBeNull();
  });

  it('pins the poster at 10:00, full quality, centred', () => {
    const query = new URLSearchParams(POSTER_SEARCH);
    expect(query.get('t')).toBe('10:00');
    expect(query.get('quality')).toBe('high');
    expect(query.get('align')).toBe('center');
  });
});
