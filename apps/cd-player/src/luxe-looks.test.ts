import { describe, expect, it } from 'vitest';
import { DECK_SWATCHES } from './deck-looks';
import {
  DEFAULT_LUXE_LOOK,
  LUXE_PART_NAMES,
  LUXE_PARTS,
  LUXE_SWATCHES,
  luxeLookFrom,
  luxeSwatch,
} from './luxe-looks';

describe('Luxe’s colours', () => {
  it('has three parts in the picker’s order, each with its own swatches and ids', () => {
    expect(LUXE_PARTS).toEqual(['body', 'metal', 'light']);
    expect(LUXE_PART_NAMES).toEqual({ body: 'Body', metal: 'Metal', light: 'Light' });
    expect(LUXE_SWATCHES.body.map((s) => s.id)).toEqual(['pink', 'silver', 'rose', 'black']);
    expect(LUXE_SWATCHES.metal.map((s) => s.id)).toEqual(['gold', 'chrome', 'rose']);
    expect(LUXE_SWATCHES.light.map((s) => s.id)).toEqual(['pink', 'amber', 'ice', 'violet']);
    expect(DEFAULT_LUXE_LOOK).toEqual({ body: 'pink', metal: 'gold', light: 'pink' });
  });

  it('names and finishes the bodies and the metals as proposed for gate 2', () => {
    expect(LUXE_SWATCHES.body).toEqual([
      {
        id: 'pink',
        name: 'Pink lacquer',
        colour: '#f2b6c6',
        metalness: 0,
        roughness: 0.2,
        coat: 1,
      },
      {
        id: 'silver',
        name: 'Brushed silver',
        colour: '#c9ccd1',
        metalness: 1,
        roughness: 0.34,
        coat: 0,
      },
      {
        id: 'rose',
        name: 'Brushed rose gold',
        colour: '#d9a493',
        metalness: 1,
        roughness: 0.34,
        coat: 0,
      },
      {
        id: 'black',
        name: 'Gloss black',
        colour: '#15151a',
        metalness: 0,
        roughness: 0.15,
        coat: 1,
      },
    ]);
    expect(LUXE_SWATCHES.metal).toEqual([
      { id: 'gold', name: 'Polished gold', colour: '#e3c27a', metalness: 1, roughness: 0.18 },
      { id: 'chrome', name: 'Chrome', colour: '#e8eaee', metalness: 1, roughness: 0.08 },
      { id: 'rose', name: 'Rose gold', colour: '#e6b0a0', metalness: 1, roughness: 0.18 },
    ]);
  });

  it('takes its four lights from the Deck’s, value for value (glow, accent, onAccent)', () => {
    for (const light of LUXE_SWATCHES.light) {
      expect(light, light.id).toEqual(DECK_SWATCHES.light.find((deck) => deck.id === light.id));
    }
  });

  it('keeps each part’s id when that part has it, and the part’s default when not', () => {
    expect(luxeLookFrom({ body: 'black', metal: 'chrome', light: 'ice' })).toEqual({
      body: 'black',
      metal: 'chrome',
      light: 'ice',
    });
    expect(luxeLookFrom({ body: 'gold', metal: 'pink', light: 'lime' })).toEqual(DEFAULT_LUXE_LOOK);
    for (const junk of [
      null,
      undefined,
      'pink',
      42,
      ['rose'],
      { body: 7 },
      { metal: '__proto__' },
    ]) {
      expect(luxeLookFrom(junk), String(junk)).toEqual(DEFAULT_LUXE_LOOK);
    }
    expect(luxeSwatch({ body: 'nope', metal: 'rose', light: 'ice' }, 'body').id).toBe('pink');
    expect(luxeSwatch({ body: 'rose', metal: 'rose', light: 'ice' }, 'metal').colour).toBe(
      '#e6b0a0',
    );
  });
});
