import { describe, expect, it } from 'vitest';
import { compileEffect } from '../shader/compile';
import type { Effect } from '../shader/types';
import { EFFECTS } from './index';
import {
  EFFECT_BY_RARITY,
  MODERN_EFFECT_BY_RARITY,
  OVERRIDE_ONLY_EFFECTS,
  type EffectId,
} from '../select';

/** Every effect selection can return: both rarity tables' effects and the override-only ones. */
const ALL_EFFECT_IDS: EffectId[] = [
  ...new Set([
    ...Object.values(EFFECT_BY_RARITY),
    ...Object.values(MODERN_EFFECT_BY_RARITY),
    ...OVERRIDE_ONLY_EFFECTS,
  ]),
];

/** Every element an effect paints: its shine, and its glare above and beneath that. */
const elementsOf = (effect: Effect) => [
  ...(effect.beneath ?? []),
  ...effect.shine,
  ...effect.glare,
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
    // .card__glare + :after, whether a glare paints above the shine or beneath
    // it. `basic` legitimately has no shine at all.
    for (const [key, effect] of Object.entries(EFFECTS)) {
      const glares = effect.glare.length + (effect.beneath?.length ?? 0);
      expect(effect.shine.length, key).toBeLessThanOrEqual(3);
      expect(glares, key).toBeLessThanOrEqual(2);
      expect(effect.shine.length + glares, key).toBeGreaterThan(0);
    }
  });

  it('gives every element at least one layer', () => {
    for (const [key, effect] of Object.entries(EFFECTS)) {
      for (const el of elementsOf(effect)) {
        expect(el.layers.length, key).toBeGreaterThan(0);
      }
    }
  });

  it('never lets a first layer carry a blend the generator drops', () => {
    // layerCode() seeds stack_<prefix> straight from layers[0]'s source and
    // never calls blendWith for it — a first layer has nothing beneath it to
    // blend against, exactly like CSS ignoring background-blend-mode on a
    // first background. A non-'normal' blend at layers[0] is silently
    // dropped by the generator, so it is always a mistake in the data.
    for (const [key, effect] of Object.entries(EFFECTS)) {
      for (const el of elementsOf(effect)) {
        expect(el.layers[0].blend, key).toBe('normal');
      }
    }
  });

  it('keeps every gradient within the shader stop limit', () => {
    for (const [key, effect] of Object.entries(EFFECTS)) {
      for (const el of elementsOf(effect)) {
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

      // Every generated shader contains 'void main()' unconditionally, so
      // asserting that only proves compileEffect() ran — it can never fail,
      // so it can never catch a dropped element or layer. Count what
      // layerCode()/elementCode() actually emit instead: one `vec3 src_`
      // declaration per layer, and one `acc = mix(acc, blendWith(` per
      // element (that exact pattern excludes the unconditional clip-region
      // line `acc = mix(art, acc, cov);`, or `mix(base, …)` with glare beneath,
      // which would otherwise be an off-by-one for every effect).
      const elements = elementsOf(effect);
      const layerCount = elements.reduce((n, el) => n + el.layers.length, 0);
      const elementCount = elements.length;
      expect((src.match(/vec3 src_/g) ?? []).length, key).toBe(layerCount);
      expect((src.match(/acc = mix\(acc, blendWith\(/g) ?? []).length, key).toBe(elementCount);
    }
  });
});
