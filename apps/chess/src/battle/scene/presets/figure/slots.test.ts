import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LINE_MAX, SLOT_GEM, SLOT_GLOW, SLOT_GOLD, SLOTS } from './slots';

describe('palette slots', () => {
  it('names 22 distinct slots, gold, glow and gem among them', () => {
    expect(SLOTS).toHaveLength(22);
    expect(new Set(SLOTS).size).toBe(22);
    expect([SLOT_GOLD, SLOT_GLOW, SLOT_GEM]).toEqual([5, 8, 12]);
  });

  it('fits the widest outline the Blender kit dresses a part with', () => {
    expect(LINE_MAX).toBeGreaterThanOrEqual(0.006);
  });

  it('numbers the slots as the Blender kit does', () => {
    const kit = readFileSync(new URL('../../../../../art/blender/kit.py', import.meta.url), 'utf8');
    const list = /^SLOTS = \[([^\]]*)\]/m.exec(kit)?.[1] ?? '';
    expect([...list.matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1])).toEqual([...SLOTS]);
  });
});
