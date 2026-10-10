import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardPiece } from '../../../game/pieces';
import type { PresetPieceProps } from './index';

// What is under test is the dispatch, not the treasures' meshes: a stand-in keeps three and drei
// out of this Node test.
vi.mock('../pieces', () => ({ Treasure: () => null }));

const piece: BoardPiece = { id: 'wk-e1', square: 'e1', type: 'k', color: 'w' };

// registerRenderer writes module state: every test starts from a fresh registry.
beforeEach(() => {
  vi.resetModules();
});

async function load() {
  const { PresetPiece, registerRenderer } = await import('./index');
  const { Treasure } = await import('../pieces');
  return { PresetPiece, registerRenderer, Treasure };
}

describe('PresetPiece', () => {
  it('draws the treasures for the treasure set', async () => {
    const { PresetPiece, Treasure } = await load();
    const el = PresetPiece({ preset: 'treasures', piece, jumping: true });
    expect(el.type).toBe(Treasure);
    expect(el.props).toEqual({ piece, jumping: true });
  });

  it('draws the treasures for a kind no renderer is registered for yet', async () => {
    const { PresetPiece, Treasure } = await load();
    for (const preset of ['holy-order', 'gentlemen', 'constellation'] as const) {
      expect(PresetPiece({ preset, piece, jumping: false }).type).toBe(Treasure);
    }
  });

  it('hands a registered kind to its renderer, whole, and leaves the rest alone', async () => {
    const { PresetPiece, registerRenderer, Treasure } = await load();
    const Chibi: ComponentType<PresetPieceProps> = () => null;
    registerRenderer('chibi', Chibi);
    for (const preset of ['holy-order', 'dark-court', 'gentlemen', 'bunny-mages'] as const) {
      const el = PresetPiece({ preset, piece, jumping: false });
      expect(el.type).toBe(Chibi);
      expect(el.props).toEqual({ preset, piece, jumping: false });
    }
    expect(PresetPiece({ preset: 'treasures', piece, jumping: false }).type).toBe(Treasure);
    expect(PresetPiece({ preset: 'constellation', piece, jumping: false }).type).toBe(Treasure);
  });
});
