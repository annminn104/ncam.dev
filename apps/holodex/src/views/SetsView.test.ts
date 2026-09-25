import { describe, expect, it } from 'vitest';
import { logoUrls } from './SetsView';

describe('logoUrls', () => {
  it('tries a set logo as WebP, then as the PNG that basep, hgss3 and xy3 only have', () => {
    // Checked 2026-09-25 across all 157 set logos: those three 404 as .webp.
    expect(logoUrls('https://assets.tcgdex.net/en/xy/xy3/logo')).toEqual([
      'https://assets.tcgdex.net/en/xy/xy3/logo.webp',
      'https://assets.tcgdex.net/en/xy/xy3/logo.png',
    ]);
  });
});
