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
});
