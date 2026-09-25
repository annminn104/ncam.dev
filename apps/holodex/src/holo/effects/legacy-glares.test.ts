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
  // radiant-holo.css: brightness(1) contrast(1.5), hard-light
  'radiant-holo': {
    blend: 'hard-light',
    filter: { brightness: 1, contrast: 1.5 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
  // rainbow-holo.css: brightness(.9) contrast(1.75), hard-light, calc(pointer-from-center * .9)
  'rainbow-holo': {
    blend: 'hard-light',
    opacity: { base: 0, fromCenter: 0.9 },
    filter: { brightness: 0.9, contrast: 1.75 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
  // rainbow-alt.css: brightness(.9) contrast(2), overlay from base.css, opacity .75
  'rainbow-alt': {
    blend: 'overlay',
    opacity: { base: 0.75 },
    filter: { brightness: 0.9, contrast: 2 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
  // secret-rare.css: brightness(1.3) contrast(1.5), hard-light
  'secret-rare': {
    blend: 'hard-light',
    filter: { brightness: 1.3, contrast: 1.5 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
  // swsh-pikachu.css: brightness(.9) contrast(2), hard-light, calc(pointer-from-center * .9)
  'swsh-pikachu': {
    blend: 'hard-light',
    opacity: { base: 0, fromCenter: 0.9 },
    filter: { brightness: 0.9, contrast: 2 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
  // v-max.css: brightness(1) contrast(1), hard-light, calc(0.2 + pointer-from-center * 0.8)
  'v-max': {
    blend: 'hard-light',
    opacity: { base: 0.2, fromCenter: 0.8 },
    filter: { brightness: 1, contrast: 1 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
  // v-regular.css: brightness(.9) contrast(1.75), hard-light, opacity .5
  'v-regular': {
    blend: 'hard-light',
    opacity: { base: 0.5 },
    filter: { brightness: 0.9, contrast: 1.75 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
  // v-star.css: :not(.masked)'s brightness(.55) contrast(2), hard-light, calc(pointer-from-center * .75)
  'v-star': {
    blend: 'hard-light',
    opacity: { base: 0, fromCenter: 0.75 },
    filter: { brightness: 0.55, contrast: 2 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
  // amazing-rare.css: :not(.masked)'s multiply, no filter
  'amazing-rare': { blend: 'multiply', layerBlends: ['normal'], box: [1, 1] },
  // shiny-rare.css: multiply, brightness(1.2) contrast(1) saturate(.7), calc(pointer-from-center), cover
  'shiny-rare': {
    blend: 'multiply',
    opacity: { base: 0, fromCenter: 1 },
    filter: { brightness: 1.2, contrast: 1, saturate: 0.7 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
  // shiny-v.css: darken, brightness(.88) contrast(2.25) saturate(.7), calc(pointer-from-center * .75), 120% 140%
  'shiny-v': {
    blend: 'darken',
    opacity: { base: 0, fromCenter: 0.75 },
    filter: { brightness: 0.88, contrast: 2.25, saturate: 0.7 },
    layerBlends: ['normal'],
    box: [1.2, 1.4],
  },
  // v-full-art.css: hard-light, brightness(1) contrast(1.2) saturate(1), opacity .75, 120% 150%
  'v-full-art': {
    blend: 'hard-light',
    opacity: { base: 0.75 },
    filter: { brightness: 1, contrast: 1.2, saturate: 1 },
    layerBlends: ['normal'],
    box: [1.2, 1.5],
  },
  // trainer-gallery-holo.css: soft-light, no filter
  'trainer-gallery-holo': { blend: 'soft-light', layerBlends: ['normal'], box: [1, 1] },
  // trainer-gallery-secret-rare.css: :not(.masked)'s brightness(.5) contrast(1), hard-light
  'trainer-gallery-secret-rare': {
    blend: 'hard-light',
    filter: { brightness: 0.5, contrast: 1 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
  // trainer-gallery-v-max.css: brightness(1) contrast(1), overlay from base.css, calc(pointer-from-center * 0.85)
  'trainer-gallery-v-max': {
    blend: 'overlay',
    opacity: { base: 0, fromCenter: 0.85 },
    filter: { brightness: 1, contrast: 1 },
    layerBlends: ['normal'],
    box: [1, 1],
  },
};

/** The eight Scarlet & Violet ports, whose glares came from pokemon-cards-151 instead. */
const SV_PORTS = [
  'ex-regular',
  'ex-full-art',
  'illustration-rare',
  'ex-special-illustration-rare',
  'hyper-rare',
  'poke-ball-holo',
  'masterball-holo',
  'sv-rare-holo',
];

it('holds every effect derived from pokemon-cards-css to a row, and no SV port', () => {
  const legacy = Object.keys(EFFECTS).filter((id) => !SV_PORTS.includes(id));
  expect(legacy).toHaveLength(22);
  expect(Object.keys(SHAPE).sort()).toEqual(legacy.sort());
});

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

describe('the single radials', () => {
  it('radiant-holo: folds its white .33 toward the grey hard-light leaves alone', () => {
    // brightness(1) contrast(1.5) turns 0.5 into 0.5: 0.33 + 0.67·0.5
    const [layer] = glareOf('radiant-holo').layers;
    expectGrey(colourAt(layer, 0), 0.665, 'at the pointer');
  });

  it('v-max: folds its white .75 the same way', () => {
    const [layer] = glareOf('v-max').layers;
    expectGrey(colourAt(layer, 0), 0.875, 'at the pointer'); // 0.75 + 0.25·0.5
  });

  it('rainbow-holo: starts from its unpositioned first stop, which CSS puts at 0%', () => {
    // hsl(0, 0%, 80%), opaque, at 0%; its next stop is at 30%
    const [layer] = glareOf('rainbow-holo').layers;
    expectGrey(colourAt(layer, 0), 0.8, 'at the pointer');
  });

  it('amazing-rare: folds its black .35 toward the white multiply leaves alone', () => {
    // no filter: 0.35·0 + 0.65·1
    const [layer] = glareOf('amazing-rare').layers;
    expectGrey(colourAt(layer, 0), 1, 'at the pointer');
    expectGrey(colourAt(layer, 1), 0.65, 'at the far corner');
  });
});

describe('the sized boxes, and the trainer galleries', () => {
  const centre = (id: string) => {
    const [layer] = glareOf(id).layers;
    if (layer.source.kind !== 'radial-pointer' || !layer.source.cssBox) throw new Error('no box');
    return layer.source.cssBox.centre.map(terms);
  };

  const expectTerms = (got: ReturnType<typeof terms>, want: PointerDriven) => {
    const w = terms(want);
    for (const k of ['base', 'fromCenter', 'fromLeft', 'fromTop'] as const) {
      expect(got[k], k).toBeCloseTo(w[k], 12);
    }
  };

  it('shiny-v: centres its 120% × 140% image on the card, the radial at the pointer in it', () => {
    // background-position: center: the image's left edge at 0.5·(1 − 1.2),
    // its top at 0.5·(1 − 1.4); the pointer's fraction of the image from there
    const [x, y] = centre('shiny-v');
    expectTerms(x, { base: -0.1, fromLeft: 1.2 });
    expectTerms(y, { base: -0.2, fromTop: 1.4 });
  });

  it('v-full-art: likewise for its 120% × 150%', () => {
    const [x, y] = centre('v-full-art');
    expectTerms(x, { base: -0.1, fromLeft: 1.2 });
    expectTerms(y, { base: -0.25, fromTop: 1.5 });
  });

  it('shiny-rare: reaches two thirds of the way to its 150% stop at the far corner', () => {
    // hsl(320, 5%, 15%): C = (1 − |2·0.15 − 1|)·0.05 = 0.015, m = 0.1425,
    // rgb(0.1575, 0.1425, 0.1525); from white at 0%, both opaque, at t = 1:
    // 1 − (1 − c)·2/3
    const [layer] = glareOf('shiny-rare').layers;
    const got = colourAt(layer, 1);
    [0.438333, 0.428333, 0.435].forEach((want, k) => expect(got[k]).toBeCloseTo(want, 4));
  });

  it('trainer-gallery-holo: holds its last stop past 60%', () => {
    // hsl(180, 11%, 35%) = rgb(0.3115, 0.3885, 0.3885), opaque
    const [layer] = glareOf('trainer-gallery-holo').layers;
    const got = colourAt(layer, 1);
    [0.3115, 0.3885, 0.3885].forEach((want, k) => expect(got[k]).toBeCloseTo(want, 4));
  });
});
