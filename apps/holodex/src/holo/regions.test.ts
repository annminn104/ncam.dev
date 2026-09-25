import { describe, expect, it } from 'vitest';
import { coversPoint, cutsFor, MAX_CUTS, regionFor, type CardLayout } from './regions';
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
  'other',
];
const SHAPES: ClipShape[] = ['full', 'regular', 'stage', 'trainer', 'borders'];
const FIXED: ClipShape[] = ['full', 'trainer', 'borders'];

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

  it('gives the trainer, border and whole-card shapes one region on every layout', () => {
    for (const layout of LAYOUTS) {
      for (const shape of FIXED) expect(regionFor(shape, layout)).toEqual(regionFor(shape));
    }
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

  it('cuts nothing out of a region that is not the art window', () => {
    for (const layout of LAYOUTS) {
      for (const shape of FIXED) expect(cutsFor(shape, layout)).toEqual([]);
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
});
