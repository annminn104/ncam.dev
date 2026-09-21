import { describe, expect, it } from 'vitest';
import { compileEffect } from '../shader/compile';
import { EFFECTS } from './index';
import { EFFECT_BY_RARITY, OVERRIDE_ONLY_EFFECTS, type EffectId } from '../select';

const ALL_EFFECT_IDS: EffectId[] = [
  ...new Set([...Object.values(EFFECT_BY_RARITY), ...OVERRIDE_ONLY_EFFECTS]),
];

describe('EFFECTS registry', () => {
  it('has an entry for every effect selection can return', () => {
    const missing = ALL_EFFECT_IDS.filter((id) => !(id in EFFECTS));
    expect(missing).toEqual([]);
  });

  it('has no entry selection can never return', () => {
    const stray = Object.keys(EFFECTS).filter((id) => !ALL_EFFECT_IDS.includes(id as EffectId));
    expect(stray).toEqual([]);
  });

  it('gives every effect an id matching its key', () => {
    for (const [key, effect] of Object.entries(EFFECTS)) expect(effect.id).toBe(key);
  });

  it('keeps every effect within the reference’s element budget', () => {
    // The reference gives each card at most .card__shine + :before + :after and
    // .card__glare + :after. `basic` legitimately has no shine at all.
    for (const [key, effect] of Object.entries(EFFECTS)) {
      expect(effect.shine.length, key).toBeLessThanOrEqual(3);
      expect(effect.glare.length, key).toBeLessThanOrEqual(2);
      expect(effect.shine.length + effect.glare.length, key).toBeGreaterThan(0);
    }
  });

  it('gives every element at least one layer', () => {
    for (const [key, effect] of Object.entries(EFFECTS)) {
      for (const el of [...effect.shine, ...effect.glare]) {
        expect(el.layers.length, key).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every gradient within the shader stop limit', () => {
    for (const [key, effect] of Object.entries(EFFECTS)) {
      for (const el of [...effect.shine, ...effect.glare]) {
        for (const layer of el.layers) {
          const s = layer.source;
          const count =
            s.kind === 'repeating-linear' || s.kind === 'linear' || s.kind === 'conic'
              ? s.stops.length
              : s.kind === 'radial-pointer'
                ? s.stops.length
                : 0;
          expect(count, `${key}/${s.kind}`).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it('compiles every effect to balanced shader source', () => {
    for (const [key, effect] of Object.entries(EFFECTS)) {
      const src = compileEffect(effect);
      expect((src.match(/\{/g) ?? []).length, key).toBe((src.match(/\}/g) ?? []).length);
      expect(src, key).toContain('void main()');
    }
  });
});
