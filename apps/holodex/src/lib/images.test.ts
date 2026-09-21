import { describe, expect, it } from 'vitest';
import { imageUrl } from './images';

const BASE = 'https://assets.tcgdex.net/en/swsh/swsh3/136';

describe('imageUrl', () => {
  it('appends the quality and format as a path suffix', () => {
    expect(imageUrl(BASE, 'low')).toBe(`${BASE}/low.webp`);
    expect(imageUrl(BASE, 'high')).toBe(`${BASE}/high.webp`);
  });

  it('supports png for the few consumers that need it', () => {
    expect(imageUrl(BASE, 'high', 'png')).toBe(`${BASE}/high.png`);
  });

  it('returns null when the card has no image (about 20% of briefs)', () => {
    expect(imageUrl(undefined, 'low')).toBeNull();
    expect(imageUrl(null, 'low')).toBeNull();
    expect(imageUrl('', 'low')).toBeNull();
  });

  it('does not double the slash when the base has a trailing one', () => {
    expect(imageUrl(`${BASE}/`, 'low')).toBe(`${BASE}/low.webp`);
  });
});
