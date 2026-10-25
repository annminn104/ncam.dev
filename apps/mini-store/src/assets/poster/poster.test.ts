import { describe, expect, it } from 'vitest';
import { poster } from './index';

const WIDTHS = { landscape: [1280, 1920, 2560], portrait: [480, 750, 1080] } as const;

describe('poster', () => {
  it('lists each shape at three widths, smallest first', () => {
    for (const shape of ['landscape', 'portrait'] as const) {
      const entries = poster[shape].avif.split(', ');
      expect(entries).toHaveLength(3);
      entries.forEach((entry, i) => {
        const w = WIDTHS[shape][i];
        expect(entry).toMatch(new RegExp(`${shape}-${w}\\.avif ${w}w$`));
      });
    }
  });

  it("falls back to a WebP and keeps each capture's aspect", () => {
    expect(poster.landscape.fallback).toMatch(/landscape-1920\.webp$/);
    expect(poster.portrait.fallback).toMatch(/portrait-750\.webp$/);
    expect(poster.landscape.width / poster.landscape.height).toBeCloseTo(2.4, 2);
    expect(poster.portrait.width / poster.portrait.height).toBe(0.5);
  });
});
