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

/** An element's filter as CSS writes it: (brightness, contrast, saturate), each a base and a pfc term. */
function filterOf(el: Element): Array<[number, number]> {
  const f = el.filter ?? {};
  return [f.brightness, f.contrast, f.saturate].map((p) => [p?.base ?? 1, p?.fromCenter ?? 0]);
}

describe('regular-holo’s shine, as regular-holo.css draws it', () => {
  const [shine] = EFFECTS['regular-holo'].shine;

  it('overlays the spectrum onto scanlines, colour-dodged through its filter', () => {
    expect(EFFECTS['regular-holo'].shine).toHaveLength(1);
    expect(shine.mixBlend).toBe('color-dodge');
    // brightness(1.1) contrast(1.1) saturate(1.2)
    expect(filterOf(shine)).toEqual([
      [1.1, 0],
      [1.1, 0],
      [1.2, 0],
    ]);
    expect(kinds(shine)).toEqual(['css-linear normal', 'css-linear overlay']);
    // black 0, black 2px, #666 2px, #666 4px
    expect(stopsOf(shine.layers[0]).map((s) => +s.color[0].toFixed(1))).toEqual([0, 0, 0.4, 0.4]);
    // --violet … --red, three times over
    expect(stopsOf(shine.layers[1])).toHaveLength(15);
  });

  it('screens two sets of bars in :before, then lays a radial in luminosity in :after', () => {
    const [before, after] = shine.children ?? [];
    expect(kinds(before)).toEqual(['css-linear normal', 'css-linear screen']);
    expect(before.mixBlend).toBe('hard-light');
    // brightness(1.15) contrast(1.1)
    expect(filterOf(before)).toEqual([
      [1.15, 0],
      [1.1, 0],
      [1, 0],
    ]);
    // bars at 6, 9, 10.5, 12, 15 and 30%: one period from 6% to 30%
    stopsOf(before.layers[0])
      .map((s) => s.at)
      .forEach((at, i) => expect(at).toBeCloseTo([0, 0.125, 0.1875, 0.25, 0.375, 1][i], 12));
    expect(kinds(after)).toEqual(['css-radial normal']);
    expect(after.mixBlend).toBe('luminosity');
    // brightness(0.6) contrast(4)
    expect(filterOf(after)).toEqual([
      [0.6, 0],
      [4, 0],
      [1, 0],
    ]);
    // hsla(0, 0%, 90%, 0.8) 0%, hsla(0, 0%, 78%, 0.1) 25%, hsl(0, 0%, 0%) 90%
    expect(stopsOf(after.layers[0]).map((s) => [s.at, s.alpha ?? 1])).toEqual([
      [0, 0.8],
      [0.25, 0.1],
      [0.9, 1],
    ]);
  });
});

describe('reverse-holo’s shine, as reverse-holo.css draws it unmasked', () => {
  const [shine] = EFFECTS['reverse-holo'].shine;

  it('soft-lights a radial onto a linear, through the card’s own foil brightness', () => {
    expect(kinds(shine)).toEqual(['css-linear normal', 'css-radial soft-light']);
    expect(shine.children ?? []).toEqual([]);
    expect(shine.mixBlend).toBe('color-dodge');
    // brightness(var(--foil-brightness)) contrast(1.5) saturate(1)
    expect(shine.filter?.brightness).toEqual({ base: 0, fromFoilBrightness: 1 });
    expect(filterOf(shine).slice(1)).toEqual([
      [1.5, 0],
      [1, 0],
    ]);
    // calc((1.5 * var(--card-opacity)) - var(--pointer-from-center))
    expect(shine.opacity).toEqual({ base: 1.5, fromCenter: -1 });
    // #000 15%, #fff, #000 85%
    expect(stopsOf(shine.layers[0]).map((s) => s.at)).toEqual([0.15, 0.5, 0.85]);
    // #fff 5%, #000 50%, #fff 80%
    expect(stopsOf(shine.layers[1]).map((s) => [s.at, s.color[0]])).toEqual([
      [0.05, 1],
      [0.5, 0],
      [0.8, 1],
    ]);
  });
});

describe('trainer-gallery-holo’s shine, as trainer-gallery-holo.css draws it', () => {
  const [shine] = EFFECTS['trainer-gallery-holo'].shine;

  it('lays pastel bands three-quarters opaque, and hard-lights an ellipse onto them', () => {
    expect(kinds(shine)).toEqual(['css-linear normal']);
    // brightness(calc((var(--pointer-from-center)*0.3) + 0.5)) contrast(2.3) saturate(1)
    expect(filterOf(shine)).toEqual([
      [0.5, 0.3],
      [2.3, 0],
      [1, 0],
    ]);
    const bands = stopsOf(shine.layers[0]);
    expect(bands).toHaveLength(7);
    expect(bands.every((s) => s.alpha === 0.75)).toBe(true);
    const [after] = shine.children ?? [];
    expect(shine.children).toHaveLength(1);
    expect(kinds(after)).toEqual(['css-radial normal']);
    expect(after.layers[0].source.kind === 'css-radial' && after.layers[0].source.ellipse).toBe(
      true,
    );
    expect(after.mixBlend).toBe('hard-light');
    // brightness(calc((var(--pointer-from-center)*0.2) + 0.4)) contrast(.85) saturate(1.1)
    expect(filterOf(after)).toEqual([
      [0.4, 0.2],
      [0.85, 0],
      [1.1, 0],
    ]);
    // hsl(0, 0%, 100%) 5%, hsla(300, 100%, 11%, 0.6) 40%, hsl(0, 0%, 22%) 120%
    expect(stopsOf(after.layers[0]).map((s) => [s.at, s.alpha ?? 1])).toEqual([
      [0.05, 1],
      [0.4, 0.6],
      [1.2, 1],
    ]);
  });
});

describe('trainer-full-art’s shine, the supporter’s, as the reference resolves it unmasked', () => {
  const [shine] = EFFECTS['trainer-full-art'].shine;

  it('colour-burns trainerbg onto the V family’s bands', () => {
    expect(kinds(shine)).toEqual([
      'css-radial normal',
      'css-linear hard-light',
      'css-linear hue',
      'trainerbg color-burn',
    ]);
    // brightness(calc((var(--pointer-from-center)*0.05) + .6)) contrast(1.5) saturate(1.2)
    expect(filterOf(shine)).toEqual([
      [0.6, 0.05],
      [1.5, 0],
      [1.2, 0],
    ]);
    expect(shine.mixBlend).toBe('color-dodge');
  });

  it('paints :after (z-index auto), then :before (z-index 1)', () => {
    const [after, before] = shine.children ?? [];
    expect(kinds(after)).toEqual(kinds(shine));
    expect(after.mixBlend).toBe('exclusion');
    expect(filterOf(after)).toEqual(filterOf(shine));
    expect(kinds(before)).toEqual(['css-radial normal']);
    expect(before.mixBlend).toBe('screen');
    expect(before.opacity).toEqual({ base: 0.5 });
    // hsl(0, 0%, 100%) 0%, hsla(0, 0%, 0%, 0) 80%
    expect(stopsOf(before.layers[0]).map((s) => [s.at, s.alpha ?? 1])).toEqual([
      [0, 1],
      [0.8, 0],
    ]);
  });
});
