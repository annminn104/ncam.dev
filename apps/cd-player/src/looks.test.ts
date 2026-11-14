import { describe, expect, it } from 'vitest';
import { clearSwatch, DEFAULT_CLEAR_LOOK } from './clear-looks';
import { DEFAULT_DECK_LOOK } from './deck-looks';
import { DEFAULT_LUXE_LOOK } from './luxe-looks';
import { DEFAULT_PERSONAL } from './personal';
import { DEFAULT_LOOK_STATE, exhaustive, lookAccent, lookLabel, lookOf, lookSwatch } from './looks';
import { skinById } from './skins';

describe('looks', () => {
  it('starts on Luxe in its default look, the suitcase in Blush and the others in theirs', () => {
    expect(DEFAULT_LOOK_STATE).toEqual({
      model: 'luxe',
      skin: 'blush',
      clear: DEFAULT_CLEAR_LOOK,
      deck: DEFAULT_DECK_LOOK,
      luxe: DEFAULT_LUXE_LOOK,
      personal: DEFAULT_PERSONAL,
    });
    expect(lookOf(DEFAULT_LOOK_STATE)).toEqual({ model: 'luxe', luxe: DEFAULT_LUXE_LOOK });
    expect(lookOf({ ...DEFAULT_LOOK_STATE, model: 'suitcase' })).toEqual({
      model: 'suitcase',
      skin: 'blush',
    });
    expect(lookOf({ ...DEFAULT_LOOK_STATE, model: 'clear' })).toEqual({
      model: 'clear',
      clear: DEFAULT_CLEAR_LOOK,
    });
  });

  it('makes Luxe’s pink light the default look’s accent, named on the Player button', () => {
    const look = lookOf(DEFAULT_LOOK_STATE);
    expect(DEFAULT_LUXE_LOOK.light).toBe('pink');
    expect(lookAccent(look)).toEqual({ accent: '#efa3c0', onAccent: '#2c111d' });
    expect(lookLabel(look)).toBe('Player: Luxe, Pink light');
  });

  it('takes the accent from the skin, or from the Clear model’s light', () => {
    const cherry = skinById('cherry');
    expect(lookAccent({ model: 'suitcase', skin: 'cherry' })).toEqual({
      accent: cherry.accent,
      onAccent: cherry.onAccent,
    });
    const pink = clearSwatch({ ...DEFAULT_CLEAR_LOOK, light: 'pink' }, 'light');
    expect(lookAccent({ model: 'clear', clear: { ...DEFAULT_CLEAR_LOOK, light: 'pink' } })).toEqual(
      { accent: pink.accent, onAccent: pink.onAccent },
    );
  });

  it('shows the leather or the light on the Player button, and names both', () => {
    expect(lookSwatch({ model: 'suitcase', skin: 'sage' })).toBe(skinById('sage').palette.leather);
    expect(lookSwatch({ model: 'clear', clear: DEFAULT_CLEAR_LOOK })).toBe(
      clearSwatch(DEFAULT_CLEAR_LOOK, 'light').glow,
    );
    expect(lookLabel({ model: 'suitcase', skin: 'blush' })).toBe('Player: Suitcase, Blush');
    expect(lookLabel({ model: 'clear', clear: DEFAULT_CLEAR_LOOK })).toBe(
      'Player: Clear, Ice light',
    );
  });

  it('draws the Deck in its own colours, its light the page’s accent', () => {
    const state = {
      ...DEFAULT_LOOK_STATE,
      model: 'deck' as const,
      deck: { body: 'silver', light: 'red' },
    };
    const look = lookOf(state);
    expect(look).toEqual({ model: 'deck', deck: { body: 'silver', light: 'red' } });
    expect(lookAccent(look)).toEqual({ accent: '#f2aaa5', onAccent: '#2c0f0d' });
    expect(lookSwatch(look)).toBe('#ff5a52');
    expect(lookLabel(look)).toBe('Player: Deck, Red light');
  });

  it('draws Luxe in its own colours, its light the page’s accent', () => {
    const luxe = { body: 'black', metal: 'chrome', light: 'violet' };
    const look = lookOf({ ...DEFAULT_LOOK_STATE, model: 'luxe', luxe });
    expect(look).toEqual({ model: 'luxe', luxe });
    expect(lookAccent(look)).toEqual({ accent: '#c8b4f2', onAccent: '#1e1430' });
    expect(lookSwatch(look)).toBe('#b48cff');
    expect(lookLabel(look)).toBe('Player: Luxe, Violet light');
  });

  it('names a model no switch has a case for, should one ever get past the compiler', () => {
    expect(() => exhaustive('glass' as never)).toThrow('glass');
    expect(() => exhaustive({ model: 'glass' } as never)).toThrow('glass');
  });
});
