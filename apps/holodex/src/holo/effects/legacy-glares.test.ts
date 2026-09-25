import { describe, expect, it } from 'vitest';
import type { BlendMode } from '../shader/blend';
import type { Element, Layer, PointerDriven } from '../shader/types';
import { EFFECTS } from './index';

/*
 * The 22 effects derived from pokemon-cards-css draw glares ported from its
 * CSS (legacy-glare.ts). Every row here is copied by hand from the rarity's
 * CSS file, and base.css where it sets nothing, and every colour worked out by
 * hand; none is computed with css.ts or legacy-glare.ts.
 */

interface GlareShape {
  /** `.card__glare`'s mix-blend-mode, or base.css's overlay */
  blend: BlendMode;
  /** its opacity calc(), less --card-opacity; left out for plain var(--card-opacity) */
  opacity?: PointerDriven;
  /** its filter, as the functions it names */
  filter?: { brightness?: number; contrast?: number; saturate?: number };
  /** layer 0 the glare's own background, then the :after's blend if it has one */
  layerBlends: BlendMode[];
  /** the background-size the radials are drawn in, as fractions of the card */
  box: [number, number];
}

const SHAPE: Record<string, GlareShape> = {
  // base.css only: basic.css styles no glare
  basic: { blend: 'overlay', layerBlends: ['normal'], box: [1, 1] },
  // regular-holo.css: opacity .8, brightness(.8) contrast(1.5), overlay, and an overlaid :after
  'regular-holo': {
    blend: 'overlay',
    opacity: { base: 0.8 },
    filter: { brightness: 0.8, contrast: 1.5 },
    layerBlends: ['normal', 'overlay'],
    box: [1, 1],
  },
  // trainer-full-art.css (supporter): opacity .75, multiply, brightness(1.5) contrast(1.4) saturate(1), 170%
  'trainer-full-art': {
    blend: 'multiply',
    opacity: { base: 0.75 },
    filter: { brightness: 1.5, contrast: 1.4, saturate: 1 },
    layerBlends: ['normal'],
    box: [1.7, 1.7],
  },
  // trainer-gallery-v-regular.css: opacity .4 over base.css's glare
  'trainer-gallery-v-regular': {
    blend: 'overlay',
    opacity: { base: 0.4 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
  // reverse-holo.css: brightness(.7) contrast(1.5), overlay from base.css; its
  // :after has no blend, so it and the glare's radial are one gradient
  'reverse-holo': {
    blend: 'overlay',
    filter: { brightness: 0.7, contrast: 1.5 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
  // cosmos-holo.css: brightness(.75) contrast(2) saturate(2), overlay,
  // opacity calc(0.25 + pointer-from-center), and a soft-lit :after
  'cosmos-holo': {
    blend: 'overlay',
    opacity: { base: 0.25, fromCenter: 1 },
    filter: { brightness: 0.75, contrast: 2, saturate: 2 },
    layerBlends: ['normal', 'soft-light'],
    box: [1, 1],
  },
  // shiny-vmax.css: brightness(1) contrast(1.25), overlay from base.css, and an overlaid :after
  'shiny-vmax': {
    blend: 'overlay',
    filter: { brightness: 1, contrast: 1.25 },
    layerBlends: ['normal', 'overlay'],
    box: [1, 1],
  },
};

const glareOf = (id: string): Element => {
  const effect = EFFECTS[id as keyof typeof EFFECTS];
  expect(effect.glare, `${id}: nothing painted above the shine`).toEqual([]);
  expect(effect.beneath, `${id}: one glare, beneath the shine`).toHaveLength(1);
  return effect.beneath![0];
};

const terms = (p: PointerDriven | undefined) => ({
  base: p?.base ?? 1,
  fromCenter: p?.fromCenter ?? 0,
  fromLeft: p?.fromLeft ?? 0,
  fromTop: p?.fromTop ?? 0,
});

/** A ported radial's colour at a distance t, from its own stops, as the shader spaces them: evenly. */
function colourAt(layer: Layer, t: number): number[] {
  const s = layer.source;
  if (s.kind !== 'radial-pointer') throw new Error('not a radial');
  const n = s.stops.length - 1;
  const x = Math.min(1, Math.max(0, t)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const f = x - i;
  return s.stops[i].color.map((c, k) => c + (s.stops[i + 1].color[k] - c) * f);
}

const expectGrey = (got: number[], want: number, label: string) =>
  got.forEach((v) => expect(v, label).toBeCloseTo(want, 4));

describe('the 22 legacy glares, ported from pokemon-cards-css', () => {
  for (const [id, want] of Object.entries(SHAPE)) {
    describe(id, () => {
      it('paints one glare beneath the shine, with its CSS blend, opacity and filter', () => {
        const glare = glareOf(id);
        expect(glare.mixBlend).toBe(want.blend);
        expect(terms(glare.opacity)).toEqual(terms(want.opacity));
        for (const fn of ['brightness', 'contrast', 'saturate'] as const) {
          expect(terms(glare.filter?.[fn]), `${id}: ${fn}`).toEqual(
            terms({ base: want.filter?.[fn] ?? 1 }),
          );
        }
      });

      it('stacks its layers as its CSS does, each radial in CSS geometry and its box', () => {
        const glare = glareOf(id);
        expect(glare.layers.map((l) => l.blend)).toEqual(want.layerBlends);
        for (const layer of glare.layers) {
          expect(layer.source.kind).toBe('radial-pointer');
          if (layer.source.kind === 'radial-pointer') {
            expect(layer.source.cssBox?.size).toEqual(want.box);
          }
        }
      });
    });
  }
});

describe('base.css’s glare, as the four that draw it port it', () => {
  // white .8 at 10%, white .65 at 20%, black .5 at 90%; t = 0 takes the first
  // stop, t = 1 the last, and 4/7, one of the eight evenly spaced samples, lies
  // 0.371429 / 0.7 = 0.530612 of the way from 20% to 90%.
  it('folds its transparency toward the grey overlay leaves alone, for basic', () => {
    const [layer] = glareOf('basic').layers;
    expectGrey(colourAt(layer, 0), 0.8 + 0.2 * 0.5, 'at the pointer'); // 0.9
    expectGrey(colourAt(layer, 1), 0.5 * 0.5, 'at the far corner'); // 0.25
    // 0.825 (white .65 over 0.5) toward 0.25, 0.530612 of the way
    expectGrey(colourAt(layer, 4 / 7), 0.825 - 0.575 * 0.530612, 'at 4/7'); // 0.519898
  });

  it('folds toward the grey that regular-holo’s filter turns into that grey', () => {
    // ((0.8·v − 0.5)·1.5 + 0.5) = 0.5 gives v = 0.625
    const [layer] = glareOf('regular-holo').layers;
    expectGrey(colourAt(layer, 0), 0.8 + 0.2 * 0.625, 'at the pointer'); // 0.925
    expectGrey(colourAt(layer, 1), 0.5 * 0.625, 'at the far corner'); // 0.3125
  });

  it('folds toward the white multiply leaves alone, as trainer-full-art’s filter takes it back', () => {
    // ((1.5·v − 0.5)·1.4 + 0.5) = 1 gives v = 0.571429
    const [layer] = glareOf('trainer-full-art').layers;
    expectGrey(colourAt(layer, 0), 0.8 + 0.2 * 0.571429, 'at the pointer'); // 0.914286
    expectGrey(colourAt(layer, 1), 0.5 * 0.571429, 'at the far corner'); // 0.285714
  });
});

describe('regular-holo’s :after', () => {
  it('bakes its own brightness(.6) contrast(3) into its first stop', () => {
    // hsl(180, 100%, 95%) is rgb(0.9, 1, 1); brightness .6 gives (0.54, 0.6,
    // 0.6), contrast 3 about 0.5 gives (0.62, 0.8, 0.8); opaque, so no fold
    const [, after] = glareOf('regular-holo').layers;
    const got = colourAt(after, 0);
    [0.62, 0.8, 0.8].forEach((want, k) => expect(got[k]).toBeCloseTo(want, 4));
  });
});

describe('the three with an :after', () => {
  it('reverse-holo: paints its :after over the glare’s radial, as one gradient', () => {
    // At t = 0 both are at their first stops: the :after's opaque white covers
    // the glare's. At t = 1 the :after is 0.8 of the way from white .5 (20%)
    // to black .5 (120%): grey 0.2 at .5, premultiplied; the glare is past its
    // black .75 at 90%. Source-over: alpha .5 + .75·.5 = .875, colour
    // (0.2·.5)/.875 = 0.114286. Folded toward the grey brightness(.7)
    // contrast(1.5) turns into 0.5, 0.5/.7 = 0.714286:
    // .875·0.114286 + .125·0.714286 = 0.189286.
    const [layer] = glareOf('reverse-holo').layers;
    expectGrey(colourAt(layer, 0), 1, 'at the pointer');
    expectGrey(colourAt(layer, 1), 0.189286, 'at the far corner');
  });

  it('cosmos-holo: fades its :after as the pointer moves down the card', () => {
    const [glare, after] = glareOf('cosmos-holo').layers;
    // calc(1 - var(--pointer-from-top) * .75)
    expect(terms(after.opacity)).toEqual(terms({ base: 1, fromTop: -0.75 }));
    // hsl(204, 100%, 95%) is rgb(0.9, 0.96, 1) at alpha .8, folded toward the
    // grey brightness(.75) contrast(2) turns into 0.5, 0.5/.75 = 0.666667
    const got = colourAt(glare, 0);
    [0.853333, 0.901333, 0.933333].forEach((want, k) => expect(got[k]).toBeCloseTo(want, 4));
  });

  it('shiny-vmax: overlays its :after, folded toward the grey overlay leaves alone', () => {
    // its last stop, black .75 at 100%, stays black through brightness(1)
    // contrast(1.25), folded toward 0.5: 0.25·0.5 = 0.125
    const [, after] = glareOf('shiny-vmax').layers;
    expectGrey(colourAt(after, 1), 0.125, 'at the far corner');
  });
});
