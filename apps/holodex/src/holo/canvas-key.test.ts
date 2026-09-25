import { describe, expect, it } from 'vitest';
import { holoCanvasKey, type CanvasKeyInput } from './canvas-key';

/** A reverse-holo Paras, keyed the way HoloCard keys it. */
const base: CanvasKeyInput = {
  cardId: 'swsh3-3',
  src: 'https://assets.tcgdex.net/en/swsh/swsh3/3/high.webp',
  selection: { effect: 'reverse-holo', shape: 'regular', invert: true, glow: [0.8, 1, 0.9833] },
  generation: 0,
};

describe('holoCanvasKey', () => {
  it('is stable while no input changes, whatever the object identity', () => {
    // HoloCard re-renders on every pointer pop; only a changed value may
    // replace its canvas.
    const copy: CanvasKeyInput = { ...base, selection: { ...base.selection } };
    expect(holoCanvasKey(copy)).toBe(holoCanvasKey(base));
  });

  // One row per input. Each one changing alone must give a new canvas: a
  // scene effect that re-runs on the old one gets the dead context back.
  it.each<[string, Partial<CanvasKeyInput>]>([
    ['a different card', { cardId: 'swsh3-25' }],
    ['a different image', { src: 'https://assets.tcgdex.net/en/swsh/swsh3/25/high.webp' }],
    ['the image going away', { src: null }],
    ['a different effect', { selection: { ...base.selection, effect: 'regular-holo' } }],
    ['a different clip shape', { selection: { ...base.selection, shape: 'stage' } }],
    ['the inversion flipping', { selection: { ...base.selection, invert: false } }],
    ['a different glow', { selection: { ...base.selection, glow: [0.9221, 0.3575, 0.2579] } }],
    ['a new generation', { generation: 1 }],
  ])('changes with %s', (_input, patch) => {
    expect(holoCanvasKey({ ...base, ...patch })).not.toBe(holoCanvasKey(base));
  });

  it("cannot collide by one input's text running into the next", () => {
    // A plain `${cardId}|${src}` join would key these two identically.
    expect(holoCanvasKey({ ...base, cardId: 'a|b', src: 'c' })).not.toBe(
      holoCanvasKey({ ...base, cardId: 'a', src: 'b|c' }),
    );
  });
});
