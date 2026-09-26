import { describe, expect, it } from 'vitest';
import {
  coversPoint,
  cutsFor,
  inkReadsFor,
  inkStripFor,
  MAX_CUTS,
  regionFor,
  type CardLayout,
} from './regions';
import type { ClipShape } from './select';

const LAYOUTS: CardLayout[] = [
  'wotc',
  'e-card',
  'ex',
  'dp',
  'dp-sp',
  'lv-x',
  'hgss',
  'prime',
  'legend',
  'bw-xy',
  'sm',
  'swsh',
  'sv',
  'pocket',
  'modern-ex',
  'sv-illustration',
  'pocket-illustration',
  'sv-special-illustration',
  'sv-hyper',
  'sv-hyper-ex',
  'sv-ultra',
  'sv-ultra-ex',
  'swsh-ultra',
  'swsh-ultra-v',
  'swsh-gallery-v',
  'swsh-vmax',
  'swsh-galarian-trainer',
  'swsh-gallery-holo',
  'swsh-vstar',
  'full-card',
  'other',
];
const SHAPES: ClipShape[] = ['full', 'regular', 'stage', 'trainer', 'borders'];
/** The layouts that measured a trainer's window of their own. */
const MEASURED_TRAINER: CardLayout[] = [
  'sv',
  'sv-special-illustration',
  'sv-hyper',
  'sv-ultra',
  'swsh-ultra',
  'swsh-galarian-trainer',
  'full-card',
];
/** The layouts that cut a trainer's window. */
const CUT_TRAINER: CardLayout[] = ['sv-hyper', 'sv-ultra', 'swsh-ultra', 'swsh-galarian-trainer'];

describe('regionFor', () => {
  it('returns the reference inset for a card no measured layout claims', () => {
    // --clip: inset(9.85% 8% 52.85% 8%)
    expect(regionFor('regular')).toEqual({ top: 0.0985, right: 0.08, bottom: 0.5285, left: 0.08 });
    expect(regionFor('regular', 'other')).toEqual(regionFor('regular'));
  });

  it('keeps the reference inset for a Sword & Shield card, whose art it fits', () => {
    expect(regionFor('regular', 'swsh')).toEqual(regionFor('regular'));
  });

  it('returns the reference inset for a trainer', () => {
    // --clip-trainer: inset(14.5% 8.5% 48.2% 8.5%)
    expect(regionFor('trainer')).toEqual({ top: 0.145, right: 0.085, bottom: 0.482, left: 0.085 });
  });

  it('returns the reference inset for the rounded border', () => {
    // --clip-borders: inset(2.8% 4%)
    expect(regionFor('borders')).toEqual({ top: 0.028, right: 0.04, bottom: 0.028, left: 0.04 });
  });

  it('covers the whole card for the full shape', () => {
    expect(regionFor('full')).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('gives the border and whole-card shapes one region on every layout', () => {
    for (const layout of LAYOUTS) {
      for (const shape of ['full', 'borders'] as const) {
        expect(regionFor(shape, layout)).toEqual(regionFor(shape));
      }
    }
  });

  it('gives a trainer the reference’s window but where a layout measured its own', () => {
    for (const layout of LAYOUTS) {
      if (MEASURED_TRAINER.includes(layout)) continue;
      expect(regionFor('trainer', layout), layout).toEqual(regionFor('trainer'));
    }
    // A Scarlet & Violet or Mega trainer's art starts 0.7% higher and ends
    // 0.2% higher than the reference's window, and reaches 0.5% further out.
    expect(regionFor('trainer', 'sv')).toEqual({
      top: 0.138,
      right: 0.077,
      bottom: 0.48,
      left: 0.08,
    });
  });

  it('gives the stage shape its layout’s art window, as regular', () => {
    for (const layout of LAYOUTS) {
      expect(regionFor('stage', layout)).toEqual(regionFor('regular', layout));
    }
  });

  it('keeps a LEGEND half’s foil to the border, its art being the whole card', () => {
    expect(regionFor('regular', 'legend')).toEqual(regionFor('borders'));
  });

  it('keeps every art window on the card, and every cut a box on the card', () => {
    for (const layout of LAYOUTS) {
      const r = regionFor('regular', layout);
      expect(Math.min(r.top, r.right, r.bottom, r.left)).toBeGreaterThanOrEqual(0);
      expect(r.left).toBeLessThan(1 - r.right);
      expect(r.top).toBeLessThan(1 - r.bottom);
      for (const shape of ['regular', 'stage'] as const) {
        for (const c of cutsFor(shape, layout)) {
          expect(c.x0).toBeLessThan(c.x1);
          expect(c.y0).toBeLessThan(c.y1);
          expect(Math.min(c.x0, c.y0)).toBeGreaterThanOrEqual(0);
          expect(Math.max(c.x1, c.y1)).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('cutsFor', () => {
  it('cuts no more boxes than the shader has uniforms for', () => {
    for (const layout of LAYOUTS) {
      for (const shape of SHAPES)
        expect(cutsFor(shape, layout).length).toBeLessThanOrEqual(MAX_CUTS);
    }
  });

  it('cuts nothing out of the border or the whole card, nor a trainer’s window unmeasured', () => {
    for (const layout of LAYOUTS) {
      for (const shape of ['full', 'borders'] as const) expect(cutsFor(shape, layout)).toEqual([]);
      if (!CUT_TRAINER.includes(layout)) expect(cutsFor('trainer', layout), layout).toEqual([]);
    }
  });

  it('foils a gold card’s whole face but its rule box, by what it is', () => {
    const covers = (shape: ClipShape, x: number, y: number, layout: CardLayout) =>
      coversPoint(shape, x, y, false, layout);
    // The rule box of an ex, and of a trainer (a Stadium's is the tallest).
    expect(covers('regular', 0.6, 0.925, 'sv-hyper-ex')).toBe(false);
    expect(covers('stage', 0.6, 0.925, 'sv-hyper-ex')).toBe(false);
    expect(covers('trainer', 0.6, 0.88, 'sv-hyper')).toBe(false);
    expect(covers('trainer', 0.6, 0.965, 'sv-hyper')).toBe(false);
    // Everything else, the border and the gold beside the box included.
    for (const [x, y] of [
      [0.01, 0.5],
      [0.5, 0.01],
      [0.5, 0.99],
      [0.2, 0.925],
      [0.5, 0.5],
    ]) {
      expect(covers('regular', x, y, 'sv-hyper-ex'), `ex ${x}, ${y}`).toBe(true);
      expect(covers('trainer', x, y, 'sv-hyper'), `trainer ${x}, ${y}`).toBe(true);
    }
    // An energy, which takes regular on the trainers' frame, has no box cut.
    expect(covers('regular', 0.6, 0.925, 'sv-hyper')).toBe(true);
    // A Mega Hyper Rare or a Crown keeps the whole card, rule box and all.
    for (const shape of ['regular', 'stage', 'trainer'] as const) {
      expect(covers(shape, 0.6, 0.925, 'full-card'), shape).toBe(true);
    }
  });

  it('foils an Ultra Rare’s whole card but its rule box and an evolution’s picture', () => {
    const covers = (shape: ClipShape, x: number, y: number, layout: CardLayout) =>
      coversPoint(shape, x, y, false, layout);
    // An ex: its rule box, and on an evolution the picture in its ring.
    expect(covers('regular', 0.6, 0.925, 'sv-ultra-ex')).toBe(false);
    expect(covers('stage', 0.6, 0.925, 'sv-ultra-ex')).toBe(false);
    expect(covers('stage', 0.1, 0.12, 'sv-ultra-ex')).toBe(false);
    expect(covers('regular', 0.1, 0.12, 'sv-ultra-ex')).toBe(true);
    // A trainer: its rule box. An energy, on the same frame: nothing.
    expect(covers('trainer', 0.6, 0.93, 'sv-ultra')).toBe(false);
    expect(covers('regular', 0.6, 0.93, 'sv-ultra')).toBe(true);
    // Everything else, the border, the tab, the band and the ring included.
    for (const [x, y] of [
      [0.01, 0.5],
      [0.5, 0.01],
      [0.5, 0.99],
      [0.08, 0.035],
      [0.4, 0.105],
      [0.02, 0.12],
      [0.2, 0.925],
      [0.5, 0.5],
    ]) {
      expect(covers('stage', x, y, 'sv-ultra-ex'), `ex ${x}, ${y}`).toBe(true);
      expect(covers('trainer', x, y, 'sv-ultra'), `trainer ${x}, ${y}`).toBe(true);
    }
  });

  it('foils a Sword & Shield Ultra Rare’s whole card but its dark bars', () => {
    const covers = (shape: ClipShape, x: number, y: number, layout: CardLayout) =>
      coversPoint(shape, x, y, false, layout);
    // A V: its weakness bar, and its V rule box into the black at the corner.
    expect(covers('regular', 0.5, 0.873, 'swsh-ultra-v')).toBe(false);
    expect(covers('regular', 0.7, 0.935, 'swsh-ultra-v')).toBe(false);
    expect(covers('regular', 0.99, 0.95, 'swsh-ultra-v')).toBe(false);
    // A Supporter: its TRAINER header and its rule box.
    expect(covers('trainer', 0.5, 0.045, 'swsh-ultra')).toBe(false);
    expect(covers('trainer', 0.6, 0.92, 'swsh-ultra')).toBe(false);
    // Everything else, the border, the illustrator's corner and the art.
    for (const [x, y] of [
      [0.01, 0.5],
      [0.5, 0.01],
      [0.5, 0.99],
      [0.2, 0.93],
      [0.5, 0.5],
    ]) {
      expect(covers('regular', x, y, 'swsh-ultra-v'), `V ${x}, ${y}`).toBe(true);
      expect(covers('trainer', x, y, 'swsh-ultra'), `Supporter ${x}, ${y}`).toBe(true);
    }
    // A VSTAR or an energy on the Supporters' frame: the whole card.
    expect(covers('regular', 0.5, 0.873, 'swsh-ultra')).toBe(true);
    expect(covers('regular', 0.5, 0.045, 'swsh-ultra')).toBe(true);
  });

  it('foils a gallery holo inside the border but its tab or picture and band, and weakness bar', () => {
    const covers = (shape: ClipShape, x: number, y: number) =>
      coversPoint(shape, x, y, false, 'swsh-gallery-holo');
    expect(regionFor('regular', 'swsh-gallery-holo')).toEqual(regionFor('borders'));
    for (const shape of ['regular', 'stage'] as const) {
      // The border, as --clip-borders, and the weakness bar.
      expect(covers(shape, 0.02, 0.5), shape).toBe(false);
      expect(covers(shape, 0.5, 0.873), shape).toBe(false);
      // The name bar, the art, the strip under the bar and the corner below.
      for (const [x, y] of [
        [0.4, 0.06],
        [0.5, 0.5],
        [0.5, 0.897],
        [0.2, 0.93],
      ]) {
        expect(covers(shape, x, y), `${shape} ${x}, ${y}`).toBe(true);
      }
    }
    // A Basic's BASIC tab; an evolution's picture of what it evolves from,
    // and the band that names it.
    expect(covers('regular', 0.1, 0.06)).toBe(false);
    expect(covers('regular', 0.1, 0.12)).toBe(true);
    expect(covers('regular', 0.3, 0.105)).toBe(true);
    expect(covers('stage', 0.1, 0.06)).toBe(false);
    expect(covers('stage', 0.1, 0.12)).toBe(false);
    expect(covers('stage', 0.3, 0.105)).toBe(false);
    expect(covers('stage', 0.3, 0.14)).toBe(true);
  });

  it('foils a VSTAR between its header and its weakness bar', () => {
    const covers = (x: number, y: number) => coversPoint('regular', x, y, false, 'swsh-vstar');
    // The border, the header, the evolves-from band and picture column under
    // it, and everything from the weakness bar down.
    for (const [x, y] of [
      [0.02, 0.5],
      [0.98, 0.5],
      [0.5, 0.05],
      [0.3, 0.11],
      [0.1, 0.14],
      [0.5, 0.873],
      [0.7, 0.935],
      [0.2, 0.93],
    ]) {
      expect(covers(x, y), `bare ${x}, ${y}`).toBe(false);
    }
    // The art, beside the band too, the attacks, the gold VSTAR Power bar,
    // which sits at one of two heights by the text above it, and the VSTAR
    // Power below it.
    for (const [x, y] of [
      [0.5, 0.3],
      [0.8, 0.11],
      [0.5, 0.55],
      [0.5, 0.61],
      [0.5, 0.67],
      [0.5, 0.75],
    ]) {
      expect(covers(x, y), `foiled ${x}, ${y}`).toBe(true);
    }
    expect(cutsFor('regular', 'swsh-vstar')).toHaveLength(2);
  });

  it('foils a Galarian Gallery Supporter’s TRAINER header, and cuts its rule box alone', () => {
    const covers = (x: number, y: number) =>
      coversPoint('trainer', x, y, false, 'swsh-galarian-trainer');
    expect(covers(0.6, 0.92)).toBe(false);
    expect(cutsFor('trainer', 'swsh-galarian-trainer')).toEqual([
      cutsFor('trainer', 'swsh-ultra')[1],
    ]);
    for (const [x, y] of [
      [0.5, 0.045],
      [0.01, 0.5],
      [0.5, 0.5],
      [0.2, 0.93],
    ]) {
      expect(covers(x, y), `${x}, ${y}`).toBe(true);
    }
  });

  it('foils a Trainer Gallery V inside its black border but its dark bars and HP strip', () => {
    const covers = (x: number, y: number) => coversPoint('regular', x, y, false, 'swsh-gallery-v');
    // The black border all round, which its masks leave out.
    for (const [x, y] of [
      [0.02, 0.5],
      [0.98, 0.5],
      [0.5, 0.015],
      [0.5, 0.985],
    ]) {
      expect(covers(x, y), `border ${x}, ${y}`).toBe(false);
    }
    // The weakness bar and the V rule box, a full-art V's, and the black
    // strip its HP is printed on, beside the name.
    expect(covers(0.5, 0.873)).toBe(false);
    expect(covers(0.7, 0.935)).toBe(false);
    expect(covers(0.85, 0.06)).toBe(false);
    expect(cutsFor('regular', 'swsh-gallery-v').slice(0, 2)).toEqual(
      cutsFor('regular', 'swsh-ultra-v'),
    );
    // Everything inside the border else: the art, the art just under the HP,
    // the name bar to its round end, the strip between the bars and the
    // illustrator's corner.
    for (const [x, y] of [
      [0.5, 0.5],
      [0.85, 0.12],
      [0.4, 0.05],
      [0.69, 0.06],
      [0.5, 0.897],
      [0.2, 0.93],
    ]) {
      expect(covers(x, y), `${x}, ${y}`).toBe(true);
    }
  });

  it('foils a gallery VMAX’s whole card but its header and its bars', () => {
    const covers = (x: number, y: number) => coversPoint('regular', x, y, false, 'swsh-vmax');
    // The header's silver panels: the VMAX mark, the picture of the V it
    // evolves from, and the bands that name it and its Dynamax.
    expect(covers(0.1, 0.06)).toBe(false);
    expect(covers(0.1, 0.13)).toBe(false);
    expect(covers(0.4, 0.105)).toBe(false);
    // The weakness bar and the VMAX rule box, where a V has its bars.
    expect(covers(0.5, 0.873)).toBe(false);
    expect(covers(0.7, 0.935)).toBe(false);
    expect(cutsFor('regular', 'swsh-vmax')).toHaveLength(3);
    // Everything else: the border, the HP, the art, the strip between the
    // bars and the illustrator's corner.
    for (const [x, y] of [
      [0.01, 0.5],
      [0.99, 0.5],
      [0.8, 0.06],
      [0.5, 0.5],
      [0.5, 0.897],
      [0.2, 0.93],
    ]) {
      expect(covers(x, y), `${x}, ${y}`).toBe(true);
    }
  });

  it('keeps the one stage box every card had for a card no measured layout claims', () => {
    expect(cutsFor('stage')).toEqual([{ x0: 0, y0: 0, x1: 0.57, y1: 0.16 }]);
    expect(cutsFor('regular')).toEqual([]);
  });
});

describe('coversPoint', () => {
  it('covers the middle of the art window and not the text box', () => {
    expect(coversPoint('regular', 0.5, 0.3, false)).toBe(true);
    expect(coversPoint('regular', 0.5, 0.8, false)).toBe(false);
  });

  it('excludes the margins', () => {
    expect(coversPoint('regular', 0.02, 0.3, false)).toBe(false);
    expect(coversPoint('regular', 0.98, 0.3, false)).toBe(false);
  });

  it('inverts exactly on every layout — reverse holo foils everything the region excludes', () => {
    const axis = Array.from({ length: 41 }, (_, i) => i / 40);
    for (const layout of LAYOUTS) {
      for (const shape of SHAPES) {
        for (const x of axis) {
          for (const y of axis) {
            expect(coversPoint(shape, x, y, true, layout)).toBe(
              !coversPoint(shape, x, y, false, layout),
            );
          }
        }
      }
    }
  });

  it('covers everything for the full shape and nothing when that is inverted', () => {
    expect(coversPoint('full', 0.01, 0.99, false)).toBe(true);
    expect(coversPoint('full', 0.5, 0.5, true)).toBe(false);
  });

  it('rounds the border’s inner corners as the card face rounds its own', () => {
    // 151's masks foil the border into the wedge each corner of the face
    // leaves inside the border rect's square corner; a point further in is
    // the face.
    const border = (x: number, y: number) => coversPoint('regular', x, y, false, 'sv', true);
    expect(border(0.0415, 0.0295)).toBe(true);
    expect(border(0.9585, 0.9705)).toBe(true);
    expect(border(0.0415, 0.9705)).toBe(true);
    expect(border(0.9585, 0.0295)).toBe(true);
    expect(border(0.045, 0.032)).toBe(false);
    expect(border(0.955, 0.968)).toBe(false);
    // The border itself, and its straight edges, as before.
    expect(border(0.02, 0.5)).toBe(true);
    expect(border(0.5, 0.015)).toBe(true);
    expect(border(0.042, 0.5)).toBe(false);
    // With no border, the whole card's own corners take none.
    expect(coversPoint('regular', 0.001, 0.001, false, 'sv', false)).toBe(false);
  });

  it('steps the stage shape in at the top-left, where the evolution box sits', () => {
    // Inside the regular window but within the stage cut-out.
    expect(coversPoint('regular', 0.2, 0.12, false)).toBe(true);
    expect(coversPoint('stage', 0.2, 0.12, false)).toBe(false);
    // Well inside the art for both.
    expect(coversPoint('stage', 0.5, 0.35, false)).toBe(true);
  });

  it('keeps a Sword & Shield evolution’s art between its banner and its picture', () => {
    // The reference's --clip-stage: the banner above 12%, the picture to 16%.
    expect(coversPoint('stage', 0.3, 0.14, false, 'swsh')).toBe(true);
    expect(coversPoint('stage', 0.3, 0.11, false, 'swsh')).toBe(false);
    expect(coversPoint('stage', 0.12, 0.15, false, 'swsh')).toBe(false);
    // One box, x < 57% by y < 16%, took the art between them too.
    expect(coversPoint('stage', 0.3, 0.14, false)).toBe(false);
  });

  it('cuts an EX evolution’s disc out of the art’s bottom left, not its top', () => {
    expect(coversPoint('stage', 0.1, 0.46, false, 'ex')).toBe(false);
    expect(coversPoint('regular', 0.1, 0.46, false, 'ex')).toBe(true);
    expect(coversPoint('stage', 0.1, 0.12, false, 'ex')).toBe(true);
  });

  it('cuts a Diamond & Pearl Basic’s banner, and an evolution’s banner and disc', () => {
    expect(coversPoint('regular', 0.15, 0.11, false, 'dp')).toBe(false);
    expect(coversPoint('regular', 0.3, 0.11, false, 'dp')).toBe(true);
    expect(coversPoint('stage', 0.3, 0.11, false, 'dp')).toBe(false);
    expect(coversPoint('stage', 0.1, 0.15, false, 'dp')).toBe(false);
    expect(coversPoint('stage', 0.3, 0.15, false, 'dp')).toBe(true);
  });

  it('reaches the edges of a HeartGold & SoulSilver window, wider and taller than the reference’s', () => {
    expect(coversPoint('regular', 0.06, 0.3, false, 'hgss')).toBe(true);
    expect(coversPoint('regular', 0.06, 0.3, false)).toBe(false);
    expect(coversPoint('regular', 0.5, 0.5, false, 'hgss')).toBe(true);
    expect(coversPoint('regular', 0.5, 0.5, false)).toBe(false);
  });

  it('cuts an SP Pokémon’s portrait out of the art’s bottom right', () => {
    expect(coversPoint('regular', 0.85, 0.47, false, 'dp-sp')).toBe(false);
    expect(coversPoint('regular', 0.5, 0.47, false, 'dp-sp')).toBe(true);
  });

  it('adds the card’s border, outside the borders rect, when the foil takes it', () => {
    const covers = (x: number, y: number, border: boolean) =>
      coversPoint('stage', x, y, false, 'sv', border);
    // The border: every edge, and the corner a stage cut would take.
    for (const [x, y] of [
      [0.5, 0.01],
      [0.5, 0.99],
      [0.02, 0.5],
      [0.98, 0.5],
      [0.01, 0.01],
    ]) {
      expect(covers(x, y, true), `${x}, ${y}`).toBe(true);
      expect(covers(x, y, false), `${x}, ${y}`).toBe(false);
    }
    // The frame inside it and the text box stay bare; the art stays foiled.
    expect(covers(0.06, 0.3, true)).toBe(false);
    expect(covers(0.5, 0.7, true)).toBe(false);
    expect(covers(0.5, 0.3, true)).toBe(true);
    // Inverted, it is all the other way round.
    expect(coversPoint('stage', 0.5, 0.01, true, 'sv', true)).toBe(false);
  });

  it('cuts a Scarlet & Violet evolution’s round picture as the circle it is, not its box', () => {
    // Beside the ring and under the band: art the picture's box took, which
    // 151's masks foil (Raichu's, Beedrill's) right up to the ring.
    expect(coversPoint('stage', 0.165, 0.18, false, 'sv')).toBe(true);
    expect(coversPoint('stage', 0.15, 0.176, false, 'sv')).toBe(true);
    // The ring and the picture inside it, out to the ring's outer edge.
    expect(coversPoint('stage', 0.12, 0.16, false, 'sv')).toBe(false);
    expect(coversPoint('stage', 0.088, 0.184, false, 'sv')).toBe(false);
    expect(coversPoint('stage', 0.16, 0.135, false, 'sv')).toBe(false);
    // An evolution's round picture is the one oval: every other cut is a box.
    const ovals = LAYOUTS.flatMap((layout) =>
      SHAPES.flatMap((shape) =>
        cutsFor(shape, layout).flatMap((c, i) => (c.oval ? [`${layout} ${shape} ${i}`] : [])),
      ),
    );
    expect(ovals).toEqual([
      'sv stage 1',
      'sv-illustration stage 1',
      'sv-special-illustration stage 0',
      'sv-ultra stage 0',
      'sv-ultra-ex stage 1',
    ]);
  });

  it('cuts the “evolves from” band to its slanted end and its underside, no art past them', () => {
    for (const layout of ['sv', 'sv-illustration'] as const) {
      const covers = (x: number, y: number) => coversPoint('stage', x, y, false, layout);
      // The band itself, and its top-right tip, which the square boxes missed.
      expect(covers(0.4, 0.105), layout).toBe(false);
      expect(covers(0.675, 0.0975), layout).toBe(false);
      // Under the band: art the boxes took, 0.5% to 0.75% of the card's height.
      expect(covers(0.4, 0.118), layout).toBe(true);
      // Past its slant, near the bottom, where the boxes' square ends reached.
      expect(covers(0.659, 0.113), layout).toBe(true);
      expect(covers(0.67, 0.112), layout).toBe(true);
    }
    // An illustration rare's band from its top, which its box began below.
    expect(coversPoint('stage', 0.4, 0.094, false, 'sv-illustration')).toBe(false);
    const band = cutsFor('stage', 'sv')[0];
    expect(band.slant).toBeLessThan(0);
    expect(cutsFor('stage', 'sv-illustration')[2]).toEqual(band);
  });

  it('keeps the foil off the ring’s rim where it flares into the band’s underside', () => {
    for (const layout of ['sv', 'sv-illustration'] as const) {
      const covers = (x: number, y: number) => coversPoint('stage', x, y, false, layout);
      // The rim past the ring's oval, just under the band.
      expect(covers(0.174, 0.12), layout).toBe(false);
      expect(covers(0.172, 0.126), layout).toBe(false);
      // The art beside it, and below where the flare meets the ring.
      expect(covers(0.18, 0.122), layout).toBe(true);
      expect(covers(0.1745, 0.13), layout).toBe(true);
      expect(covers(0.175, 0.14), layout).toBe(true);
    }
  });

  it('cuts a full art Pokémon’s printed title where its scan is inked, and nowhere else', () => {
    // The title strip: the name, its HP and the number, after the stage tab.
    for (const layout of [
      'sv-illustration',
      'sv-special-illustration',
      'sv-ultra-ex',
      'sv-hyper-ex',
    ] as const) {
      for (const shape of ['regular', 'stage'] as const) {
        const strip = inkStripFor(shape, layout);
        expect(strip, `${layout} ${shape}`).toBeDefined();
        expect(coversPoint(shape, 0.4, 0.06, false, layout, false, true), layout).toBe(false);
        expect(coversPoint(shape, 0.4, 0.06, false, layout, false, false), layout).toBe(true);
        // ink anywhere else is the art's
        expect(coversPoint(shape, 0.4, 0.3, false, layout, false, true), layout).toBe(true);
      }
    }
    // The regular frame's title sits above its art, and an energy on the
    // trainers' frames has none.
    expect(inkStripFor('regular', 'sv')).toBeUndefined();
    expect(inkStripFor('trainer', 'sv')).toBeUndefined();
    expect(inkStripFor('regular', 'sv-ultra')).toBeUndefined();
    expect(inkStripFor('regular', 'sv-hyper')).toBeUndefined();
    expect(coversPoint('regular', 0.4, 0.06, false, 'sv-ultra', false, true)).toBe(true);
  });

  it('cuts a full art Pokémon’s BASIC or STAGE tab letters by their ink too, read lighter', () => {
    for (const layout of ['sv-special-illustration', 'sv-ultra-ex', 'sv-hyper-ex'] as const) {
      for (const shape of ['regular', 'stage'] as const) {
        // the tab's letters, where the frames foil the tab round them
        expect(coversPoint(shape, 0.08, 0.045, false, layout, false, true), layout).toBe(false);
        expect(coversPoint(shape, 0.08, 0.045, false, layout, false, false), layout).toBe(true);
        // two reads, the title's and the tab's, whose grey letters read lighter
        const reads = inkReadsFor(shape, layout);
        expect(reads, layout).toHaveLength(2);
        const [title, tab] = reads;
        expect(tab.dark ?? 0).toBeGreaterThan(title.dark ?? 80);
        // the strip the texture spans holds both
        const strip = inkStripFor(shape, layout)!;
        for (const { box: b } of reads) {
          expect(b.x0 >= strip.x0 && b.x1 <= strip.x1 && b.y0 >= strip.y0 && b.y1 <= strip.y1).toBe(
            true,
          );
        }
      }
    }
    // a trainer reads its name alone
    expect(inkReadsFor('trainer', 'sv-ultra')).toHaveLength(1);
    expect(inkReadsFor('regular', 'sv')).toEqual([]);
  });

  it('cuts a full art trainer’s printed name, on the panel under its TRAINER banner', () => {
    for (const layout of ['sv-special-illustration', 'sv-ultra', 'sv-hyper'] as const) {
      const strip = inkStripFor('trainer', layout);
      expect(strip, layout).toBeDefined();
      expect(strip, layout).not.toEqual(inkStripFor('regular', 'sv-illustration'));
      expect(coversPoint('trainer', 0.3, 0.11, false, layout, false, true), layout).toBe(false);
      expect(coversPoint('trainer', 0.3, 0.11, false, layout, false, false), layout).toBe(true);
      // the banner above it, and the art below, keep theirs
      expect(coversPoint('trainer', 0.3, 0.05, false, layout, false, true), layout).toBe(true);
      expect(coversPoint('trainer', 0.3, 0.3, false, layout, false, true), layout).toBe(true);
    }
  });

  it('lays an evolution’s round picture over the border as well, where a banner’s box stops', () => {
    const covers = (x: number, y: number) => coversPoint('stage', x, y, false, 'sv', true);
    // The ring where it overlaps the silver border: bare, as on the masks.
    expect(covers(0.02, 0.13)).toBe(false);
    expect(covers(0.03, 0.1)).toBe(false);
    // The border round it, and beside the band, whose box cuts the art alone.
    expect(covers(0.005, 0.13)).toBe(true);
    expect(covers(0.02, 0.25)).toBe(true);
    expect(covers(0.02, 0.05)).toBe(true);
    expect(covers(0.5, 0.015)).toBe(true);
    // With no border to foil, nothing changes beside the art.
    expect(coversPoint('stage', 0.005, 0.13, false, 'sv', false)).toBe(false);
  });

  it('cuts a Scarlet & Violet evolution’s band and picture, and no more of its art', () => {
    // Under the band, right of the picture: art the old 57% by 16% step took.
    expect(coversPoint('stage', 0.3, 0.14, false, 'sv')).toBe(true);
    expect(coversPoint('stage', 0.3, 0.14, false)).toBe(false);
    // The band and the picture themselves.
    expect(coversPoint('stage', 0.4, 0.11, false, 'sv')).toBe(false);
    expect(coversPoint('stage', 0.12, 0.16, false, 'sv')).toBe(false);
    // A reverse foil, inverted, lays its foil over both and not over the art.
    expect(coversPoint('stage', 0.12, 0.16, true, 'sv')).toBe(true);
    expect(coversPoint('stage', 0.3, 0.14, true, 'sv')).toBe(false);
  });

  it('foils an ex of the modern frames but its art, inverted, to the card’s very edge', () => {
    // ex-regular inverts it (select.ts): the text box and the border take the
    // foil, the illustration none, the evolution's picture being part of it.
    expect(coversPoint('stage', 0.5, 0.7, true, 'modern-ex')).toBe(true);
    expect(coversPoint('stage', 0.01, 0.3, true, 'modern-ex')).toBe(true);
    expect(coversPoint('stage', 0.5, 0.3, true, 'modern-ex')).toBe(false);
    expect(coversPoint('stage', 0.1, 0.1, true, 'modern-ex')).toBe(false);
    expect(cutsFor('stage', 'modern-ex')).toEqual([]);
  });

  it('foils an illustration rare’s whole card inside its border but its tab', () => {
    const covers = (shape: ClipShape, x: number, y: number) =>
      coversPoint(shape, x, y, false, 'sv-illustration');
    // The illustration, to the border on every side, and the text over it.
    for (const [x, y] of [
      [0.5, 0.3],
      [0.5, 0.7],
      [0.05, 0.5],
      [0.95, 0.5],
      [0.5, 0.035],
      [0.5, 0.965],
    ]) {
      expect(covers('regular', x, y), `${x}, ${y}`).toBe(true);
    }
    // The border itself, and the BASIC tab over the top-left.
    for (const [x, y] of [
      [0.02, 0.5],
      [0.5, 0.015],
      [0.5, 0.985],
      [0.1, 0.05],
    ]) {
      expect(covers('regular', x, y), `${x}, ${y}`).toBe(false);
    }
    // A Basic keeps the art under where an evolution's picture sits.
    expect(covers('regular', 0.1, 0.12)).toBe(true);
  });

  it('cuts an illustration rare evolution’s picture and band as well', () => {
    for (const layout of ['sv-illustration', 'pocket-illustration'] as const) {
      // The picture below the tab, the band beside it, art all around.
      expect(coversPoint('stage', 0.1, 0.12, false, layout), layout).toBe(false);
      expect(coversPoint('stage', 0.4, 0.105, false, layout), layout).toBe(false);
      expect(coversPoint('stage', 0.4, 0.07, false, layout), layout).toBe(true);
      expect(coversPoint('stage', 0.4, 0.14, false, layout), layout).toBe(true);
      expect(coversPoint('stage', 0.1, 0.25, false, layout), layout).toBe(true);
    }
  });

  it('cuts an illustration rare evolution’s ring as the circle it is, with its tab and band', () => {
    const covers = (x: number, y: number) => coversPoint('stage', x, y, false, 'sv-illustration');
    // Beside the ring's lower right: art the picture's box took, which 151's
    // masks foil right up to the ring.
    expect(covers(0.17, 0.18)).toBe(true);
    expect(covers(0.15, 0.176)).toBe(true);
    // The ring, and its rim between the tab and the band, stay bare.
    expect(covers(0.16, 0.135)).toBe(false);
    expect(covers(0.088, 0.184)).toBe(false);
    expect(covers(0.15, 0.08)).toBe(false);
    // The ring is the regular frame's.
    expect(cutsFor('stage', 'sv-illustration')[1]).toEqual(cutsFor('stage', 'sv')[1]);
  });

  it('cuts a special illustration or Ultra Rare evolution’s picture as the disc it is, none of its ring', () => {
    for (const layout of ['sv-special-illustration', 'sv-ultra', 'sv-ultra-ex'] as const) {
      const covers = (x: number, y: number) => coversPoint('stage', x, y, false, layout);
      // The ring beside the disc, which the picture's box took.
      expect(covers(0.16, 0.175), layout).toBe(true);
      expect(covers(0.155, 0.078), layout).toBe(true);
      // The disc, out to its left edge, which the box left foiled.
      expect(covers(0.094, 0.122), layout).toBe(false);
      expect(covers(0.032, 0.122), layout).toBe(false);
      expect(covers(0.094, 0.169), layout).toBe(false);
    }
  });

  it('foils a special illustration rare’s whole card, border and all, but the pre-evolution picture', () => {
    const covers = (shape: ClipShape, x: number, y: number) =>
      coversPoint(shape, x, y, false, 'sv-special-illustration');
    // The border, the tab, the band, the text, the rule box: all foil.
    for (const [x, y] of [
      [0.01, 0.5],
      [0.5, 0.01],
      [0.08, 0.035],
      [0.4, 0.105],
      [0.5, 0.7],
      [0.5, 0.93],
    ]) {
      for (const shape of ['regular', 'stage', 'trainer'] as const) {
        expect(covers(shape, x, y), `${shape} ${x}, ${y}`).toBe(true);
      }
    }
    // The picture inside an evolution's ring, and that only on an evolution.
    expect(covers('stage', 0.1, 0.12)).toBe(false);
    expect(covers('regular', 0.1, 0.12)).toBe(true);
    expect(covers('trainer', 0.1, 0.12)).toBe(true);
    // The ring round it keeps its foil, as the masks do.
    expect(covers('stage', 0.02, 0.12)).toBe(true);
    expect(covers('stage', 0.1, 0.185)).toBe(true);
    expect(regionFor('trainer', 'sv-special-illustration')).toEqual(regionFor('full'));
  });
});
