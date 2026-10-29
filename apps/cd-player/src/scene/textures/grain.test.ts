import { describe, expect, it } from 'vitest';
import { leatherNormal } from './grain';

describe('leatherNormal', () => {
  it('is an opaque, deterministic, mostly upward normal map', () => {
    const map = leatherNormal(64, 8, 3);
    expect(map).toHaveLength(64 * 64 * 4);
    expect(leatherNormal(64, 8, 3)).toEqual(map);
    let blue = 0;
    for (let i = 0; i < map.length; i += 4) {
      expect(map[i + 3]).toBe(255);
      blue += map[i + 2];
    }
    expect(blue / (64 * 64)).toBeGreaterThan(200);
  });
});
