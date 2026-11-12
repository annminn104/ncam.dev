import { describe, expect, it } from 'vitest';
import { EMPTY_VIEW, type SceneView } from '../../bridge';
import { DEFAULT_CLEAR_LOOK } from '../../clear-looks';
import { deckSwatch, type DeckLook } from '../../deck-looks';
import type { Look } from '../../looks';
import { DEFAULT_PERSONAL, engraving, styleFor, type Personal } from '../../personal';
import { DEFAULT_SKIN } from '../../skins';
import { collectionSeed, type PatternPrint } from './deck-pattern';
import { nameOnly, NAME_SETTLE_MS, printFor } from './deck-print';

const DECK_LOOK: DeckLook = { body: 'black', light: 'ice' };
const DECK: Look = { model: 'deck', deck: DECK_LOOK };
const music: Personal = { pattern: 'music', name: 'DJ Lan' };

const viewOf = (key: string | null, name = 'Top 50 - Global'): SceneView => ({
  ...EMPTY_VIEW,
  collection: key === null ? null : { name, subtitle: 'Spotify', key },
});

describe('printFor', () => {
  it('prints nothing off the Deck', () => {
    const view = viewOf('playlist:p');
    expect(printFor({ model: 'suitcase', skin: DEFAULT_SKIN }, music, view)).toBeNull();
    expect(printFor({ model: 'clear', clear: DEFAULT_CLEAR_LOOK }, music, view)).toBeNull();
  });

  it('carries the look, the name, the collection and the seed of its key', () => {
    const print = printFor(DECK, music, viewOf('playlist:p'));
    expect(print).toMatchObject({
      light: deckSwatch(DECK_LOOK, 'light'),
      body: deckSwatch(DECK_LOOK, 'body'),
      name: 'DJ Lan',
      collection: 'Top 50 - Global',
      seed: collectionSeed('playlist:p'),
    });
  });

  it('names ncam and no collection before the visitor has either', () => {
    const print = printFor(DECK, DEFAULT_PERSONAL, viewOf(null));
    expect(print?.name).toBe(engraving(''));
    expect(print?.name).toBe('ncam');
    expect(print?.collection).toBe('');
    expect(print?.seed).toBe(collectionSeed(null));
  });

  it('gives From the music the style its seed picks, and Plain none', () => {
    const seed = collectionSeed('album:a');
    expect(printFor(DECK, music, viewOf('album:a'))?.style).toBe(styleFor('music', seed));
    expect(printFor(DECK, { ...music, pattern: 'plain' }, viewOf('album:a'))?.style).toBeNull();
    expect(printFor(DECK, { ...music, pattern: 'circuit' }, viewOf('album:a'))?.style).toBe(
      'circuit',
    );
  });

  it('gives two keys two seeds', () => {
    const a = printFor(DECK, music, viewOf('playlist:p'));
    const b = printFor(DECK, music, viewOf('album:p'));
    expect(a?.seed).not.toBe(b?.seed);
  });
});

describe('nameOnly', () => {
  const base = printFor(DECK, music, viewOf('playlist:p')) as PatternPrint;
  const named = { ...base, name: 'DJ Lan Anh' };

  it('is true for a change of the name alone', () => {
    expect(nameOnly(base, named)).toBe(true);
  });

  it('is false for a change of anything else, or of the name with anything else', () => {
    expect(nameOnly(base, { ...base, collection: 'Other' })).toBe(false);
    expect(nameOnly(base, { ...base, seed: base.seed + 1 })).toBe(false);
    expect(nameOnly(base, { ...base, style: 'circuit' })).toBe(false);
    expect(
      nameOnly(base, { ...base, body: deckSwatch({ ...DECK_LOOK, body: 'silver' }, 'body') }),
    ).toBe(false);
    expect(nameOnly(base, { ...named, collection: 'Other' })).toBe(false);
  });

  it('is false for no change and from nothing', () => {
    expect(nameOnly(base, base)).toBe(false);
    expect(nameOnly(null, named)).toBe(false);
  });
});

it('settles a typed name in a moment', () => {
  expect(NAME_SETTLE_MS).toBe(150);
});
