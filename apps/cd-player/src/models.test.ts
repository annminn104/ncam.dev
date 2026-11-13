import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, MODELS, modelById } from './models';

describe('models', () => {
  it('offers the suitcase, the Clear model, the Deck and Luxe, in that order, each with its own GLB', () => {
    expect(MODELS.map((m) => m.id)).toEqual(['suitcase', 'clear', 'deck', 'luxe']);
    expect(MODELS.map((m) => m.name)).toEqual(['Suitcase', 'Clear', 'Deck', 'Luxe']);
    expect(MODELS.map((m) => m.glb)).toEqual([
      'assets/cd-player.glb',
      'assets/cd-player-clear.glb',
      'assets/cd-player-deck.glb',
      'assets/cd-player-luxe.glb',
    ]);
    expect(MODELS.map((m) => m.looks)).toEqual(['skins', 'parts', 'parts', 'parts']);
  });

  it('answers the suitcase for an id it does not know', () => {
    expect(DEFAULT_MODEL).toBe('suitcase');
    expect(modelById('clear').id).toBe('clear');
    expect(modelById('deck').name).toBe('Deck');
    expect(modelById('luxe').name).toBe('Luxe');
    for (const id of ['glass', '', null, undefined, 'toString', '__proto__']) {
      expect(modelById(id).id, String(id)).toBe('suitcase');
    }
  });
});
