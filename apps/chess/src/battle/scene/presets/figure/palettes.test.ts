import { describe, expect, it } from 'vitest';
import { PRESETS } from '../../../../presets-meta';
import { FIGURE_PALETTES, isFigurePreset } from './palettes';
import { SLOTS } from './slots';

describe('figure palettes', () => {
  it('colour every slot on both sides of every figure preset', () => {
    for (const p of PRESETS.filter((x) => x.kind === 'figure')) {
      expect(isFigurePreset(p.id), p.id).toBe(true);
      if (!isFigurePreset(p.id)) continue;
      for (const side of ['w', 'b'] as const) {
        const colours = FIGURE_PALETTES[p.id][side];
        expect(colours, `${p.id} ${side}`).toHaveLength(SLOTS.length);
        for (const c of colours) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('know no preset that is not a figure preset', () => {
    expect(isFigurePreset('treasures')).toBe(false);
    expect(isFigurePreset('gentlemen')).toBe(false);
  });

  it('keep the sides apart where it matters: robes and gems', () => {
    const { w, b } = FIGURE_PALETTES['holy-order'];
    expect(w[SLOTS.indexOf('main')]).toBe('#f4f6fb');
    expect(b[SLOTS.indexOf('main')]).toBe('#1c1d24');
    expect(w[SLOTS.indexOf('gem')]).not.toBe(b[SLOTS.indexOf('gem')]);
  });

  it("dress the Dark Overlord Court's sides in bone and in black", () => {
    const { w, b } = FIGURE_PALETTES['dark-court'];
    expect(w[SLOTS.indexOf('main')]).toBe('#e9e4d6');
    expect(b[SLOTS.indexOf('main')]).toBe('#121016');
    expect(w[SLOTS.indexOf('glow')]).not.toBe(b[SLOTS.indexOf('glow')]);
  });
});
