import { describe, expect, it } from 'vitest';
import { CLEAR_SWATCHES } from './clear-looks';
import {
  DECK_PART_NAMES,
  DECK_PARTS,
  DECK_SWATCHES,
  DEFAULT_DECK_LOOK,
  deckLookFrom,
  deckSwatch,
} from './deck-looks';
import { BLACK, WHITE, contrast, cssNumber, cssToken, inkOf, mix, rgb } from './testing/contrast';

describe('the Deck’s colours', () => {
  it('has two parts in the picker’s order, each with its own swatches and ids', () => {
    expect(DECK_PARTS).toEqual(['body', 'light']);
    expect(DECK_PART_NAMES).toEqual({ body: 'Body', light: 'Light' });
    expect(DECK_SWATCHES.body.map((s) => s.id)).toEqual(['black', 'silver', 'white']);
    expect(DECK_SWATCHES.light.map((s) => s.id)).toEqual([
      'ice',
      'amber',
      'pink',
      'lime',
      'red',
      'violet',
    ]);
    expect(DEFAULT_DECK_LOOK).toEqual({ body: 'black', light: 'ice' });
  });

  it('takes its body from the Clear’s frame, four lights from the Clear’s, and adds red and violet', () => {
    for (const body of DECK_SWATCHES.body) {
      expect(body, body.id).toEqual(CLEAR_SWATCHES.frame.find((frame) => frame.id === body.id));
    }
    for (const id of ['ice', 'amber', 'pink', 'lime']) {
      expect(
        DECK_SWATCHES.light.find((light) => light.id === id),
        id,
      ).toEqual(CLEAR_SWATCHES.light.find((light) => light.id === id));
    }
    expect(DECK_SWATCHES.light.find((light) => light.id === 'red')).toEqual({
      id: 'red',
      name: 'Red',
      glow: '#ff5a52',
      accent: '#f2aaa5',
      onAccent: '#2c0f0d',
    });
    expect(DECK_SWATCHES.light.find((light) => light.id === 'violet')).toEqual({
      id: 'violet',
      name: 'Violet',
      glow: '#b48cff',
      accent: '#c8b4f2',
      onAccent: '#1e1430',
    });
  });

  it('keeps each part’s id when that part has it, and the part’s default when not', () => {
    expect(deckLookFrom({ body: 'silver', light: 'violet' })).toEqual({
      body: 'silver',
      light: 'violet',
    });
    expect(deckLookFrom({ body: 'champagne', light: 'neon' })).toEqual(DEFAULT_DECK_LOOK);
    for (const junk of [
      null,
      undefined,
      'black',
      42,
      ['silver'],
      { body: 7 },
      { light: '__proto__' },
    ]) {
      expect(deckLookFrom(junk), String(junk)).toEqual(DEFAULT_DECK_LOOK);
    }
    expect(deckSwatch({ body: 'nope', light: 'red' }, 'body').id).toBe('black');
    expect(deckSwatch({ body: 'white', light: 'red' }, 'light').glow).toBe('#ff5a52');
  });

  it('keeps every light readable as the page’s accent, as the Clear’s are', () => {
    const hover = cssNumber(
      /\.cdp-button--primary:hover:not\(:disabled\)\s*\{\s*background:\s*color-mix\(in srgb, var\(--cdp-accent\) (\d+)%, var\(--cdp-ink\)\);/,
    );
    const press = cssNumber(
      /\.cdp-button--primary:active:not\(:disabled\)\s*\{\s*background:\s*color-mix\(in srgb, var\(--cdp-accent\) (\d+)%, rgb\(0 0 0\)\);/,
    );
    const wash = cssNumber(
      /--cdp-wash:\s*color-mix\(in srgb, var\(--cdp-accent\) (\d+)%, rgb\(255 255 255\)\);/,
    );
    const art = cssNumber(/\.cdp-backdrop__layer::before\s*\{[^}]*opacity:\s*([\d.]+);/);
    const [ink, faint, error, panel] = ['ink', 'ink-faint', 'error', 'panel'].map(cssToken);
    for (const light of DECK_SWATCHES.light) {
      const accent = rgb(light.accent);
      const text = rgb(light.onAccent);
      for (const fill of [
        accent,
        mix(accent, hover / 100, ink.colour),
        mix(accent, press / 100, BLACK),
      ]) {
        expect(contrast(text, fill), light.id).toBeGreaterThanOrEqual(4.5);
      }
      const page = mix(mix(accent, wash / 100, WHITE), 1 - art, BLACK);
      const glass = mix(panel.colour, panel.alpha, page);
      expect(contrast(ink.colour, page), light.id).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(mix(faint.colour, faint.alpha, glass), glass),
        light.id,
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrast(error.colour, glass), light.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(inkOf(accent), glass), light.id).toBeGreaterThanOrEqual(3);
    }
  });
});
