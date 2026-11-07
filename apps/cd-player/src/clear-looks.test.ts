import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CLEAR_PARTS,
  CLEAR_SWATCHES,
  DEFAULT_CLEAR_LOOK,
  PART_NAMES,
  clearLookFrom,
  clearSwatch,
} from './clear-looks';
import { BLACK, WHITE, contrast, cssNumber, cssToken, inkOf, mix, rgb } from './testing/contrast';

const HEX = /^#[0-9a-f]{6}$/;

describe('the Clear model’s colours', () => {
  it('has four parts in the picker’s order, each with its own swatches and ids', () => {
    expect(CLEAR_PARTS).toEqual(['shell', 'frame', 'board', 'light']);
    expect(Object.values(PART_NAMES)).toEqual(['Shell', 'Frame', 'Board', 'Light']);
    for (const part of CLEAR_PARTS) {
      const ids = CLEAR_SWATCHES[part].map((s) => s.id);
      expect(new Set(ids).size, part).toBe(ids.length);
      expect(ids, part).toContain(DEFAULT_CLEAR_LOOK[part]);
    }
    expect(DEFAULT_CLEAR_LOOK).toEqual({
      shell: 'clear',
      frame: 'silver',
      board: 'green',
      light: 'ice',
    });
  });

  it('writes every colour as a six-digit lower-case sRGB hex, the frame’s finish in 0…1', () => {
    for (const s of CLEAR_SWATCHES.shell) expect(s.tint, s.id).toMatch(HEX);
    for (const s of CLEAR_SWATCHES.board) expect(s.colour, s.id).toMatch(HEX);
    for (const s of CLEAR_SWATCHES.light)
      for (const c of [s.glow, s.accent, s.onAccent]) expect(c, s.id).toMatch(HEX);
    for (const s of CLEAR_SWATCHES.frame) {
      expect(s.colour, s.id).toMatch(HEX);
      for (const v of [s.metalness, s.roughness]) expect(v >= 0 && v <= 1, s.id).toBe(true);
    }
  });

  it('keeps each part’s id when that part has it, and the part’s default when not', () => {
    expect(
      clearLookFrom({ shell: 'smoke', frame: 'black', board: 'purple', light: 'pink' }),
    ).toEqual({
      shell: 'smoke',
      frame: 'black',
      board: 'purple',
      light: 'pink',
    });
    expect(clearLookFrom({ shell: 'smoke', light: 'neon', board: 3 })).toEqual({
      ...DEFAULT_CLEAR_LOOK,
      shell: 'smoke',
    });
    for (const junk of [null, undefined, 'clear', 42, [], { __proto__: { shell: 'smoke' } }]) {
      expect(clearLookFrom(junk), String(junk)).toEqual(DEFAULT_CLEAR_LOOK);
    }
    expect(clearSwatch({ ...DEFAULT_CLEAR_LOOK, light: 'neon' }, 'light').id).toBe('ice');
  });

  it('keeps every light readable as the page’s accent, as the skins are', () => {
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
    for (const light of CLEAR_SWATCHES.light) {
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

  it('reads every colour from src/clear-looks.json, the one file that holds them', () => {
    const file = JSON.parse(
      readFileSync(new URL('./clear-looks.json', import.meta.url), 'utf8'),
    ) as unknown;
    expect(file).toEqual(CLEAR_SWATCHES);
  });
});
