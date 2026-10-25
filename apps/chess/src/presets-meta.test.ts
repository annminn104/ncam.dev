import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  contrastOf,
  DEFAULT_PRESET,
  isPresetId,
  pieceLabel,
  PRESETS,
  presetMeta,
  presetPreview,
  readyPresets,
  resolvePresets,
} from './presets-meta';

const IDS = ['treasures', 'holy-order', 'dark-court', 'gentlemen', 'bunny-mages', 'constellation'];

describe('presets-meta', () => {
  it('lists the six presets in lobby order, treasures first and default', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(IDS);
    expect(DEFAULT_PRESET).toBe('treasures');
  });

  it('gives every preset six piece names, both swatches and a contrast pair', () => {
    for (const p of PRESETS) {
      expect(Object.keys(p.pieces).sort()).toEqual(['b', 'k', 'n', 'p', 'q', 'r']);
      for (const side of ['w', 'b'] as const) {
        expect(p.swatches[side]).toHaveLength(3);
        for (const c of p.swatches[side]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(presetMeta(p.contrast).contrast).toBe(p.id); // pairs are symmetric
    }
  });

  it('pins the contrast pairs and display names from the spec', () => {
    expect(presetMeta('holy-order').contrast).toBe('dark-court');
    expect(presetMeta('gentlemen').contrast).toBe('bunny-mages');
    expect(presetMeta('constellation').contrast).toBe('treasures');
    expect(presetMeta('holy-order').pieces.k).toBe('Patriarch');
    expect(presetMeta('dark-court').pieces.p).toBe('Battle Maid');
    expect(presetMeta('constellation').pieces.n).toBe('Pegasus');
  });

  it('draws Holy Order and the Dark Overlord Court with the Blender figures', () => {
    expect(presetMeta('holy-order').kind).toBe('figure');
    expect(presetMeta('dark-court').kind).toBe('figure');
  });

  it('keeps the treasures names identical to the game', () => {
    expect(pieceLabel('treasures', 'k')).toEqual({
      name: 'Heaven Seal',
      piece: 'King',
      glyph: '王',
    });
    expect(pieceLabel('holy-order', 'b')).toEqual({ name: 'Bishop', piece: 'Bishop', glyph: '象' });
  });

  it('only offers ready presets, and falls back to itself when its contrast is not ready', () => {
    expect(readyPresets().every((p) => p.ready)).toBe(true);
    expect(readyPresets()[0].id).toBe('treasures');
    for (const p of PRESETS) {
      const c = contrastOf(p.id);
      expect(c === p.contrast ? presetMeta(c).ready : c === p.id).toBe(true);
    }
  });

  it('recognises preset ids', () => {
    expect(isPresetId('holy-order')).toBe(true);
    expect(isPresetId('mars')).toBe(false);
    expect(isPresetId(3)).toBe(false);
  });

  it('resolves linked hot-seat to the same set on both sides', () => {
    const choice = {
      mode: 'hotseat',
      whitePreset: 'holy-order',
      blackPreset: 'holy-order',
      linkPresets: true,
    } as const;
    expect(resolvePresets(choice, 'w')).toEqual({ w: 'holy-order', b: 'holy-order' });
  });

  it('resolves linked vs-AI to the player set and its contrast for the AI', () => {
    const choice = {
      mode: 'ai',
      whitePreset: 'constellation',
      blackPreset: 'constellation',
      linkPresets: true,
    } as const;
    // treasures is ready from Task 1 on, so constellation's contrast resolves.
    expect(resolvePresets(choice, 'w')).toEqual({ w: 'constellation', b: 'treasures' });
    expect(resolvePresets(choice, 'b')).toEqual({ w: 'treasures', b: 'constellation' });
  });

  it('resolves unlinked choices as they are, in both modes', () => {
    const choice = {
      mode: 'ai',
      whitePreset: 'holy-order',
      blackPreset: 'constellation',
      linkPresets: false,
    } as const;
    expect(resolvePresets(choice, 'w')).toEqual({ w: 'holy-order', b: 'constellation' });
    expect(resolvePresets({ ...choice, mode: 'hotseat' }, 'b')).toEqual({
      w: 'holy-order',
      b: 'constellation',
    });
  });

  it('builds preview paths under presets/', () => {
    expect(presetPreview('holy-order', 640, 'https://x.dev/')).toBe(
      'https://x.dev/presets/holy-order-640.avif',
    );
  });

  it('offers Holy Order and the Dark Overlord Court next to the treasures, with lobby previews', () => {
    for (const id of ['holy-order', 'dark-court'] as const) {
      expect(presetMeta(id), id).toMatchObject({ kind: 'figure', ready: true, preview: true });
    }
    expect(readyPresets().map((p) => p.id)).toEqual(['treasures', 'holy-order', 'dark-court']);
  });

  it('ships both preview sizes for every preset that claims them', () => {
    for (const p of PRESETS.filter((x) => x.preview)) {
      for (const width of [320, 640]) {
        const file = new URL(`../public/presets/${p.id}-${width}.avif`, import.meta.url);
        expect(existsSync(file), `${p.id}-${width}`).toBe(true);
      }
    }
  });

  it('answers Holy Order with the Dark Overlord Court vs the AI, and the other way round', () => {
    const choice = {
      mode: 'ai',
      whitePreset: 'holy-order',
      blackPreset: 'holy-order',
      linkPresets: true,
    } as const;
    expect(resolvePresets(choice, 'w')).toEqual({ w: 'holy-order', b: 'dark-court' });
    expect(resolvePresets(choice, 'b')).toEqual({ w: 'dark-court', b: 'holy-order' });
    const court = { ...choice, whitePreset: 'dark-court', blackPreset: 'dark-court' } as const;
    expect(resolvePresets(court, 'w')).toEqual({ w: 'dark-court', b: 'holy-order' });
  });
});
