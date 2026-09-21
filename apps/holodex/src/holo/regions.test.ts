import { describe, expect, it } from 'vitest';
import { coversPoint, regionFor, SHAPE_ID } from './regions';

describe('regionFor', () => {
  it('returns the reference inset for a regular card', () => {
    // --clip: inset(9.85% 8% 52.85% 8%)
    expect(regionFor('regular')).toEqual({ top: 0.0985, right: 0.08, bottom: 0.5285, left: 0.08 });
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

  it('gives the stage shape the same outer bounds as regular', () => {
    const stage = regionFor('stage');
    const regular = regionFor('regular');
    expect(stage.left).toBe(regular.left);
    expect(stage.bottom).toBe(regular.bottom);
  });
});

describe('SHAPE_ID', () => {
  it('assigns every shape a distinct integer for the shader', () => {
    const ids = Object.values(SHAPE_ID);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
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

  it('inverts exactly — reverse holo foils everything the region excludes', () => {
    for (const [x, y] of [
      [0.5, 0.3],
      [0.5, 0.8],
      [0.02, 0.3],
    ] as const) {
      expect(coversPoint('regular', x, y, true)).toBe(!coversPoint('regular', x, y, false));
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
});
