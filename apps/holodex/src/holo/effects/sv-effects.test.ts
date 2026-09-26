import { describe, expect, it } from 'vitest';
import { buildMaterial } from '../material';
import { BLEND_ID, blendRGB, type BlendMode } from '../shader/blend';
import { compileEffect } from '../shader/compile';
import type { Effect, Element, Layer, Source } from '../shader/types';
import { filterRGB, gradientT, grey, valueAt, type FixedFilter, type RGB } from './css';
import { exFullArt } from './ex-full-art';
import { exRegular } from './ex-regular';
import { exSpecialIllustrationRare } from './ex-special-illustration-rare';
import { hyperRare } from './hyper-rare';
import { illustrationRare } from './illustration-rare';
import { masterballHolo } from './masterball-holo';
import { pokeBallHolo } from './poke-ball-holo';
import { svRareHolo } from './sv-rare-holo';

/**
 * The eight Scarlet & Violet effects, keyed by the id each is registered under
 * in EFFECTS. The registry test (index.test.ts) holds them to every rule it
 * holds the others to — id, element budget, layers, first-layer blend, stop
 * limit, compiled source — so this file keeps only what it does not check:
 * that each builds into a material providing every uniform its shader
 * declares (material.test.ts checks that for two effects and a synthetic
 * one), and each effect's own port of its reference CSS.
 */
const SV_EFFECTS: Record<string, Effect> = {
  'ex-regular': exRegular,
  'ex-full-art': exFullArt,
  'illustration-rare': illustrationRare,
  'ex-special-illustration-rare': exSpecialIllustrationRare,
  'hyper-rare': hyperRare,
  'poke-ball-holo': pokeBallHolo,
  'masterball-holo': masterballHolo,
  'sv-rare-holo': svRareHolo,
};

/** An element's filter, evaluated at a pointer. */
const filterAt = (el: Element, fromCenter: number): FixedFilter => ({
  brightness: valueAt(el.filter?.brightness, { fromCenter }),
  contrast: valueAt(el.filter?.contrast, { fromCenter }),
  saturate: valueAt(el.filter?.saturate, { fromCenter }),
});

const expectClose = (got: RGB, want: RGB, label?: string) =>
  got.forEach((v, i) => expect(v, label).toBeCloseTo(want[i], 9));

/** Every `uniform <type> <name>;` a compiled shader declares, as material.test.ts reads them. */
const declaredUniforms = (source: string): string[] =>
  Array.from(source.matchAll(/uniform\s+\w+\s+(\w+)\s*(?:\[[^\]]*\])?\s*;/g), (match) => match[1]);

describe('the SV effects, beyond the registry’s rules', () => {
  it('builds each into a material that provides every uniform its shader declares', () => {
    for (const [key, effect] of Object.entries(SV_EFFECTS)) {
      const material = buildMaterial(effect);
      const declared = declaredUniforms(material.fragmentShader);
      expect(declared.length, key).toBeGreaterThan(0);
      for (const name of declared) {
        expect(material.uniforms, `${key}: ${name}`).toHaveProperty(name);
      }
      material.dispose();
    }
  });
});

describe('the SV effects’ glares stack as the reference’s z-index stacks them', () => {
  // The reference paints a card's layers by z-index (base.css: .card__glitter 2,
  // .card__shine 3), whatever their order in the markup or their translateZ. A
  // .card__glare or .card__glare2 its rarity's CSS gives no z-index paints
  // beneath the shine; one it lifts over 3 paints above. Checked against the
  // shipped poke-151 in a headless browser: lifting the Poké Ball's glare2 to
  // z-index 4 turns its text box from green, rgb(190,223,69), to the olive
  // rgb(171,173,99) this port showed while it painted every glare above.
  const STACKING: Record<string, { beneath: BlendMode[]; above: BlendMode[] }> = {
    // .card__glare and .card__glare2: z-index 4
    'ex-regular': { beneath: [], above: ['color-burn', 'lighten'] },
    // .card__glare: none
    'ex-full-art': { beneath: ['hard-light'], above: [] },
    // .card__glare and .card__glare2: none, in markup order
    'illustration-rare': { beneath: ['overlay', 'screen'], above: [] },
    'ex-special-illustration-rare': { beneath: ['multiply', 'overlay'], above: [] },
    'hyper-rare': { beneath: ['multiply', 'overlay'], above: [] },
    // .card__glare2: none; .card__glare: z-index 5
    'poke-ball-holo': { beneath: ['multiply'], above: ['overlay'] },
    'masterball-holo': { beneath: ['multiply'], above: ['overlay'] },
    // regular-holo.css's .card__glare: none
    'sv-rare-holo': { beneath: ['overlay'], above: [] },
  };

  it('covers every SV effect', () => {
    expect(Object.keys(STACKING).sort()).toEqual(Object.keys(SV_EFFECTS).sort());
  });

  for (const [id, want] of Object.entries(STACKING)) {
    it(`${id}: ${want.beneath.length} beneath the shine, ${want.above.length} above it`, () => {
      const effect = SV_EFFECTS[id];
      expect((effect.beneath ?? []).map((e) => e.mixBlend)).toEqual(want.beneath);
      expect(effect.glare.map((e) => e.mixBlend)).toEqual(want.above);
    });
  }
});

describe('sv-rare-holo', () => {
  const [shine] = svRareHolo.shine;

  it('stacks the shine as regular-holo.css composites its group', () => {
    // luminosity(multiply(holo, screen(bars, bars)), radial), overlaid onto the
    // card: multiply commutes, so the screened bars come first and the holo
    // multiplies onto them
    expect(shine.layers.map((l) => [l.source.kind, l.blend])).toEqual([
      ['repeating-linear', 'normal'],
      ['repeating-linear', 'screen'],
      ['repeating-linear', 'multiply'],
      ['radial-pointer', 'luminosity'],
    ]);
    expect(shine.mixBlend).toBe('overlay');
  });

  it('slides its two sets of bars opposite ways as the pointer moves down the card', () => {
    // background-position: 50% calc(var(--background-y) * -1.2), and * 1.2
    const drift = (layer: Layer) =>
      gradientT(layer, [0.5, 0.5], { fromLeft: 0.5, fromTop: 1 }) -
      gradientT(layer, [0.5, 0.5], { fromLeft: 0.5, fromTop: 0 });
    const [lower, upper] = shine.layers;
    expect(drift(lower)).not.toBe(0);
    expect(Math.sign(drift(upper))).toBe(-Math.sign(drift(lower)));
  });
});

describe('illustration-rare', () => {
  const [shine] = illustrationRare.shine;

  it('stacks the shine as illustration-rare.css does, and the shader blends it in that order', () => {
    // background-image: var(--grain), repeating-linear-gradient(0deg, …),
    // repeating-linear-gradient(var(--angle), …), radial-gradient(…), with
    // background-blend-mode: screen, hue, hard-light. CSS lists both top first.
    const reference: Array<[Source['kind'], BlendMode]> = [
      ['radial-pointer', 'normal'],
      ['repeating-linear', 'hard-light'],
      ['repeating-linear', 'hue'],
      ['grain', 'screen'],
    ];
    expect(shine.layers.slice(0, 4).map((l) => [l.source.kind, l.blend])).toEqual(reference);
    const src = compileEffect(illustrationRare);
    const at = reference
      .slice(1)
      .map(([, blend], i) =>
        src.indexOf(
          `stack_shine0 = blendWith(${BLEND_ID[blend]}, stack_shine0, src_shine0_${i + 1});`,
        ),
      );
    expect(Math.min(...at)).toBeGreaterThanOrEqual(0);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('folds in the :after as the soft-light it is, its bands running against the shine’s', () => {
    const bands = shine.layers[1];
    const after = shine.layers[shine.layers.length - 1];
    expect(after.blend).toBe('soft-light');
    // The :after's bands sit at calc(var(--background-x) * -1) where the
    // shine's sit at var(--background-x), so as the pointer crosses the card
    // they slide opposite ways.
    const drift = (layer: Layer) =>
      gradientT(layer, [0.5, 0.5], { fromLeft: 1, fromTop: 0.5 }) -
      gradientT(layer, [0.5, 0.5], { fromLeft: 0, fromTop: 0.5 });
    expect(Math.sign(drift(after))).toBe(-Math.sign(drift(bands)));
    expect(drift(bands)).not.toBe(0);
  });
});

describe('ex-regular', () => {
  it('turns what its glitter’s radial mask hides into the grey hard-light ignores', () => {
    const [glitter] = exRegular.shine;
    const [keep, back] = glitter.layers.slice(-2);
    if (keep.source.kind !== 'radial-pointer' || back.source.kind !== 'radial-pointer') {
      throw new Error('the glitter does not end in its two mask layers');
    }
    const [kept, added] = [keep.source.stops, back.source.stops];
    const through = (stack: RGB, i: number, fromCenter: number) =>
      filterRGB(
        blendRGB(back.blend, blendRGB(keep.blend, stack, kept[i].color), added[i].color),
        filterAt(glitter, fromCenter),
      );
    const card: RGB = [0.8, 0.3, 0.55];
    for (const stack of [grey(0), [0.9, 0.2, 0.6] as RGB, grey(1)]) {
      for (const fromCenter of [0, 1]) {
        // at the pointer the mask is transparent: the card comes through as it was
        expectClose(blendRGB(glitter.mixBlend, card, through(stack, 0, fromCenter)), card);
        // at its far edge it is opaque: the glitter as its filter leaves it
        expectClose(
          through(stack, kept.length - 1, fromCenter),
          filterRGB(stack, filterAt(glitter, fromCenter)),
        );
      }
    }
  });

  it('puts each of its shine’s pseudo-elements through its own filter, then the shine’s, and dodges it', () => {
    const shineFilter = { brightness: 0.45, contrast: 1.5, saturate: 1.2 }; // base.css .card__shine
    const own = [
      { brightness: 1, contrast: 1.5, saturate: 2 }, // ex-regular.css :before
      { brightness: 1.2, contrast: 1, saturate: 2 }, // :after
    ];
    exRegular.shine.slice(1).forEach((el, i) => {
      expect(el.mixBlend).toBe('color-dodge');
      for (const c of [grey(0.5), grey(0.6), [0.55, 0.5, 0.52] as RGB]) {
        const want = filterRGB(filterRGB(c, own[i]), shineFilter);
        expectClose(filterRGB(c, filterAt(el, 0)), want, `pseudo ${i}`);
      }
    });
  });
});

describe('ex-full-art', () => {
  it('puts its :after through its own filter, then the shine’s, brightening away from the centre', () => {
    // brightness(calc((var(--pointer-from-center) * .4) + .5)) on both, with
    // contrast(2.5) saturate(.66) on the shine and contrast(1.66) on the :after
    const [shine, after] = exFullArt.shine;
    for (const fromCenter of [0, 1]) {
      const brightness = 0.5 + 0.4 * fromCenter;
      const shineFilter = { brightness, contrast: 2.5, saturate: 0.66 };
      for (const c of [grey(0.5), grey(0.6), grey(0.7), [0.62, 0.55, 0.5] as RGB]) {
        expectClose(filterRGB(c, filterAt(shine, fromCenter)), filterRGB(c, shineFilter));
        const want = filterRGB(filterRGB(c, { brightness, contrast: 1.66 }), shineFilter);
        expectClose(filterRGB(c, filterAt(after, fromCenter)), want);
      }
    }
    expect(filterRGB(grey(0.6), filterAt(after, 1))[0]).toBeGreaterThan(
      filterRGB(grey(0.6), filterAt(after, 0))[0],
    );
    expect(after.mixBlend).toBe('color-dodge');
  });
});

describe('ex-special-illustration-rare and hyper-rare', () => {
  it('differ only where their CSS files do: the glitter’s opacity', () => {
    const lessGlitterOpacity = (effect: Effect) => ({
      ...effect,
      id: '',
      shine: effect.shine.map((el, i) => (i === 0 ? { ...el, opacity: undefined } : el)),
    });
    expect(lessGlitterOpacity(hyperRare)).toEqual(lessGlitterOpacity(exSpecialIllustrationRare));
    // calc(var(--card-opacity) * (.2 + var(--pointer-from-center) * .3)), and .5 for the SIR
    const glow = (effect: Effect, fromCenter: number) =>
      valueAt(effect.shine[0].opacity, { fromCenter });
    for (const fromCenter of [0, 0.5, 1]) {
      expect(glow(hyperRare, fromCenter)).toBeCloseTo(0.2 + 0.3 * fromCenter, 12);
      expect(glow(exSpecialIllustrationRare, fromCenter)).toBeCloseTo(0.2 + 0.5 * fromCenter, 12);
    }
  });

  for (const effect of [exSpecialIllustrationRare, hyperRare]) {
    const group = effect.shine[1];

    it(`${effect.id}: hard-lights the :after onto the :before, though the :after lies first`, () => {
      // The stack holds the :after's bands when the :before's holo lands on
      // them, the other way up from the reference, where the :after is the
      // source. Pairs either side of 0.5 tell overlay and hard-light apart.
      const holo = group.layers[group.layers.length - 1];
      expect(holo.source.kind).toBe('repeating-linear');
      for (const [before, after] of [
        [0.8, 0.3],
        [0.3, 0.8],
        [0.2, 0.1],
        [0.9, 0.7],
      ]) {
        expectClose(
          blendRGB(holo.blend, grey(after), grey(before)),
          blendRGB('hard-light', grey(before), grey(after)),
        );
      }
    });

    it(`${effect.id}: gives the :after's bands its contrast(.75) before the holo lands on them`, () => {
      const kinds = group.layers.map((l) => l.source.kind);
      const solids = group.layers.filter((l) => l.source.kind === 'solid');
      expect(kinds.lastIndexOf('linear')).toBeLessThan(kinds.indexOf('solid'));
      expect(kinds.lastIndexOf('solid')).toBeLessThan(kinds.indexOf('repeating-linear'));
      for (const x of [0, 0.25, 0.5, 0.75, 1]) {
        const out = solids.reduce((acc, layer) => {
          if (layer.source.kind !== 'solid') throw new Error('not solid');
          return blendRGB(layer.blend, acc, layer.source.color);
        }, grey(x));
        expect(out[0]).toBeCloseTo((x - 0.5) * 0.75 + 0.5, 12);
      }
    });
  }
});

describe('poke-ball-holo and masterball-holo', () => {
  const families = [
    {
      effect: pokeBallHolo,
      own: ['pokeball', 'pokeball-inner'],
      other: ['masterball', 'masterball-inner'],
    },
    {
      effect: masterballHolo,
      own: ['masterball', 'masterball-inner'],
      other: ['pokeball', 'pokeball-inner'],
    },
  ] as const;

  for (const { effect, own, other } of families) {
    it(`${effect.id}: shows its foil on the glyphs of its pattern and leaves the card alone off them`, () => {
      for (const kind of own) {
        const el = effect.shine.find((e) => e.layers.some((l) => l.source.kind === kind));
        if (!el) throw new Error(`${effect.id} never samples ${kind}`);
        const i = el.layers.findIndex((l) => l.source.kind === kind);
        // Above the foil it masks, and multiplied in like everything above it,
        // so where the pattern is black (textures.ts) the stack stays black.
        expect(i, kind).toBeGreaterThan(0);
        for (const layer of el.layers.slice(i)) expect(layer.blend, kind).toBe('multiply');
        for (const fromCenter of [0, 0.5, 1]) {
          const f = filterAt(el, fromCenter);
          // Every kind of card area, black included: off the glyphs the filters
          // must keep black black, which color-dodges the card to itself.
          for (const card of [grey(0), grey(0.2), [0.9, 0.6, 0.3] as RGB, grey(1)]) {
            // off the glyphs, black through the filter: the card as it was
            expectClose(blendRGB(el.mixBlend, card, filterRGB(grey(0), f)), card, kind);
          }
        }
        // on a glyph, the foil beneath it reaches a dark card
        const lit = blendRGB(el.mixBlend, grey(0.2), filterRGB(grey(0.9), filterAt(el, 1)));
        expect(Math.max(...lit), kind).toBeGreaterThan(0.2);
      }
    });

    it(`${effect.id}: samples its own ball patterns in the shader and never the other ball’s`, () => {
      const src = compileEffect(effect);
      const calls = (kind: string) => {
        const fn = `src${kind.replace(/(^|-)(\w)/g, (_, _dash, c: string) => c.toUpperCase())}`;
        return (src.match(new RegExp(`= ${fn}\\(uv_`, 'g')) ?? []).length;
      };
      for (const kind of own) expect(calls(kind), kind).toBe(1);
      for (const kind of other) expect(calls(kind), kind).toBe(0);
    });

    it(`${effect.id}: dodges its glyphs onto the card through the shine’s filter, as the reference’s group does`, () => {
      // poke-ball-holo.css: the :before and :after blend into .card__shine, whose
      // brightness(.75) contrast(1) saturate(1) then color-dodges the whole group
      const group = { brightness: 0.75, contrast: 1, saturate: 1 };
      const caps = effect.shine.find((e) => e.layers.some((l) => l.source.kind === own[1]));
      const outlines = effect.shine.find((e) => e.layers.some((l) => l.source.kind === own[0]));
      if (!caps || !outlines) throw new Error(`${effect.id} is missing a glyph element`);
      for (const el of [caps, outlines]) expect(el.mixBlend).toBe('color-dodge');
      for (const fromCenter of [0, 0.5, 1]) {
        for (const c of [grey(0.55), grey(0.65), [0.62, 0.55, 0.5] as RGB]) {
          // :before: brightness(.75) contrast(2) saturate(calc(var(--pointer-from-center)))
          const capsOwn = { brightness: 0.75, contrast: 2, saturate: fromCenter };
          expectClose(
            filterRGB(c, filterAt(caps, fromCenter)),
            filterRGB(filterRGB(c, capsOwn), group),
          );
          // :after: saturate(calc(var(--pointer-from-center) * 1.1)); its brightness and
          // contrast are baked into its gradient, ahead of the mask
          const outlinesOwn = { brightness: 1, contrast: 1, saturate: 1.1 * fromCenter };
          expectClose(
            filterRGB(c, filterAt(outlines, fromCenter)),
            filterRGB(filterRGB(c, outlinesOwn), group),
          );
        }
      }
    });

    it(`${effect.id}: keeps its balls inside the silver border, which only the shine’s own dodge reaches`, () => {
      // poke-ball-holo.css clips the :before and :after to --clip-borders-invert, inside a
      // .card__shine clipped to --clip-invert, which takes the border in
      const isGlyph = (e: Element) =>
        e.layers.some((l) => (own as readonly string[]).includes(l.source.kind));
      expect(effect.shine.filter(isGlyph)).toHaveLength(2);
      for (const el of effect.shine)
        expect(el.clip, JSON.stringify(el.layers[0].source.kind)).toBe(
          isGlyph(el) ? 'borders' : undefined,
        );
    });

    it(`${effect.id}: gives the caps 53% of the reference’s opacity for them`, () => {
      const caps = effect.shine.find((e) => e.layers.some((l) => l.source.kind === own[1]));
      for (const fromCenter of [0, 0.25, 0.5, 0.75]) {
        // calc(var(--card-opacity) + (var(--pointer-from-center)) - 0.75), card opacity 1
        const reference = 1 + fromCenter - 0.75;
        expect(valueAt(caps?.opacity, { fromCenter })).toBeCloseTo(0.53 * reference, 12);
      }
    });
  }
});
