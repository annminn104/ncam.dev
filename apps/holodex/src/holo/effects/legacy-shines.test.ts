import { describe, expect, it } from 'vitest';
import type { Effect, Element, GradientStop, Layer } from '../shader/types';
import { EFFECTS } from './index';

/**
 * The 22 older effects' shines, ported from pokemon-cards-css on its unmasked
 * path (docs/superpowers/specs/2026-09-25-holodex-legacy-shine-ports-
 * design.md). Every value here is copied by hand from the rarity's CSS, never
 * computed with css.ts, so a conversion that drifts shows up against the CSS
 * it came from. Layers are listed bottom first, CSS's order reversed.
 */

/** Each layer's source kind and blend, bottom first. */
const kinds = (el: Element) => el.layers.map((l: Layer) => `${l.source.kind} ${l.blend}`);

/** An exact gradient's stops. */
function stopsOf(layer: Layer): GradientStop[] {
  const { source } = layer;
  if (source.kind === 'css-linear' || source.kind === 'css-radial' || source.kind === 'css-conic') {
    return source.stops;
  }
  throw new Error(`${source.kind} is not an exact gradient`);
}

describe('secret-rare’s shine, as secret-rare.css draws it unmasked', () => {
  const effect: Effect = EFFECTS['secret-rare'];
  const [shine] = effect.shine;

  it('is one group, colour-dodged through the unmasked filter', () => {
    expect(effect.shine).toHaveLength(1);
    expect(shine.mixBlend).toBe('color-dodge');
    // brightness(calc((var(--pointer-from-center) * 0.3) + 0.2)) contrast(2) saturate(0.75)
    expect(shine.filter).toEqual({
      brightness: { base: 0.2, fromCenter: 0.3 },
      contrast: { base: 2 },
      saturate: { base: 0.75 },
    });
  });

  it('stacks its background bottom first: radial, conic, then both glitters', () => {
    expect(kinds(shine)).toEqual([
      'css-radial normal',
      'css-conic overlay',
      'glitter hard-light',
      'glitter soft-light',
    ]);
    // hsla(150, 0%, 0%, .98) 10%, hsla(0, 0%, 95%, .15) 90%
    expect(stopsOf(shine.layers[0])).toEqual([
      { at: 0.1, color: [0, 0, 0], alpha: 0.98 },
      { at: 0.9, color: [0.95, 0.95, 0.95], alpha: 0.15 },
    ]);
    // --sunpillar-clr-4, 5, 6, 1, 4, spread evenly around
    expect(stopsOf(shine.layers[1]).map((s) => s.at)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    // --glittersize: 25% each way
    expect(shine.layers[2].size).toEqual([4, 4]);
    expect(shine.layers[3].size).toEqual([4, 4]);
  });

  it('paints :before, then :after', () => {
    const [before, after] = shine.children ?? [];
    expect(shine.children).toHaveLength(2);

    expect(kinds(before)).toEqual([
      'css-radial normal',
      'css-linear multiply',
      'geometric hard-light',
    ]);
    expect(before.mixBlend).toBe('lighten');
    expect(before.opacity).toEqual({ base: 0.8 });
    expect(before.filter).toEqual({
      brightness: { base: 1.25 },
      contrast: { base: 1.25 },
      saturate: { base: 0.35 },
    });
    // hsla(10, 20%, 90%, 0.95) 10%, hsl(0, 0%, 0%) 70%
    expect(stopsOf(before.layers[0]).map((s) => [s.at, s.alpha ?? 1])).toEqual([
      [0.1, 0.95],
      [0.7, 1],
    ]);

    expect(kinds(after)).toEqual(['glitter normal']);
    expect(after.mixBlend).toBe('overlay');
    // brightness(calc((var(--pointer-from-center)*0.6) + 0.6)) contrast(1.5)
    expect(after.filter).toEqual({
      brightness: { base: 0.6, fromCenter: 0.6 },
      contrast: { base: 1.5 },
      saturate: { base: 1 },
    });
  });

  it('keeps its glare beneath, as ported', () => {
    expect(effect.beneath).toHaveLength(1);
    expect(effect.beneath?.[0].mixBlend).toBe('hard-light');
    expect(effect.glare).toEqual([]);
  });
});

describe('radiant-holo’s shine, as radiant-holo.css draws it unmasked', () => {
  const effect: Effect = EFFECTS['radiant-holo'];
  const [shine] = effect.shine;

  it('is one group, colour-dodged through its filter', () => {
    expect(effect.shine).toHaveLength(1);
    expect(shine.mixBlend).toBe('color-dodge');
    // brightness(.5) contrast(2) saturate(1.75)
    expect(shine.filter).toEqual({
      brightness: { base: 0.5 },
      contrast: { base: 2 },
      saturate: { base: 1.75 },
    });
  });

  it('crosses two sets of grey bars under a glowing ellipse', () => {
    expect(kinds(shine)).toEqual([
      'css-linear normal',
      'css-linear darken',
      'css-radial exclusion',
    ]);
    for (const layer of shine.layers.slice(0, 2)) {
      const stops = stopsOf(layer);
      // 10% 0% and 1%, then each grey for one --barwidth (1.2%), ten of them
      expect(stops).toHaveLength(21);
      expect(stops.map((s) => +s.color[0].toFixed(3))).toEqual([
        0.1, 0.1, 0.1, 0.2, 0.2, 0.35, 0.35, 0.425, 0.425, 0.5, 0.5, 0.425, 0.425, 0.35, 0.35, 0.2,
        0.2, 0.1, 0.1, 0, 0,
      ]);
      expect(stops[0].at).toBe(0);
      expect(stops[20].at).toBeCloseTo(1, 12);
      expect(layer.source.kind === 'css-linear' && layer.source.repeating).toBe(true);
    }
    // farthest-corner ellipse, hsl(0, 0%, 95%) 20%, var(--card-glow) 130%
    const ellipse = shine.layers[2].source;
    expect(ellipse.kind === 'css-radial' && ellipse.ellipse).toBe(true);
    expect(stopsOf(shine.layers[2])).toEqual([
      { at: 0.2, color: [0.95, 0.95, 0.95] },
      { at: 1.3, color: [0, 0, 0], glow: 1 },
    ]);
  });

  it('paints :after (z-index auto) before :before (z-index 2)', () => {
    const [after, before] = shine.children ?? [];
    expect(shine.children).toHaveLength(2);

    expect(kinds(after)).toEqual(['css-linear normal', 'trainerbg difference']);
    expect(after.mixBlend).toBe('color-dodge');
    expect(after.clip).toBe('regular');
    // brightness(.6) contrast(3) saturate(2)
    expect(after.filter).toEqual({
      brightness: { base: 0.6 },
      contrast: { base: 3 },
      saturate: { base: 2 },
    });
    expect(stopsOf(after.layers[0])).toHaveLength(7);

    expect(kinds(before)).toEqual(['css-radial normal', 'glitter color-dodge']);
    expect(before.mixBlend).toBe('overlay');
    // brightness(.66) contrast(2) saturate(.5)
    expect(before.filter).toEqual({
      brightness: { base: 0.66 },
      contrast: { base: 2 },
      saturate: { base: 0.5 },
    });
    // hsla(0, 0%, 58%, 0.8) 10%, hsla(0, 0%, 20%, 0.9) 20%, hsla(0, 0%, 20%, 0.5) 50%
    expect(stopsOf(before.layers[0]).map((s) => [s.at, s.alpha])).toEqual([
      [0.1, 0.8],
      [0.2, 0.9],
      [0.5, 0.5],
    ]);
    // 15% 15%
    expect(before.layers[1].size).toEqual([1 / 0.15, 1 / 0.15]);
  });

  it('keeps its glare beneath, as ported', () => {
    expect(effect.beneath).toHaveLength(1);
    expect(effect.beneath?.[0].mixBlend).toBe('hard-light');
    expect(effect.glare).toEqual([]);
  });
});
