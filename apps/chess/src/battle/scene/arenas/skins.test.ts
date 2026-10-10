import { describe, expect, it } from 'vitest';
import { ARENAS } from '../../../arenas-meta';
import { ARENA_SKINS } from './skins';

const HEX = /^#[0-9a-f]{6}$/i;

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const arenas = ARENAS.map((a) => [a.name, a.id] as const);

describe('ARENA_SKINS', () => {
  it('has a board for exactly the arenas the lobby offers', () => {
    expect(Object.keys(ARENA_SKINS).sort()).toEqual(ARENAS.map((a) => a.id).sort());
  });

  it.each(arenas)('%s has every board colour', (_, id) => {
    const skin = ARENA_SKINS[id];
    for (const key of ['light', 'dark', 'frame', 'highlight'] as const) {
      expect(skin[key]).toMatch(HEX);
    }
  });

  it.each(arenas)('%s reads as a chequerboard, light squares over dark', (_, id) => {
    const { light, dark } = ARENA_SKINS[id];
    expect(luminance(light)).toBeGreaterThan(luminance(dark));
    expect(contrast(light, dark)).toBeGreaterThanOrEqual(2);
  });
});
