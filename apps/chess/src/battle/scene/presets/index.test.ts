import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardPiece } from '../../../game/pieces';
import type { PresetPieceProps } from './index';

// What is under test is the dispatch, not the treasures' meshes: stand-ins keep the treasures'
// three and drei out of this Node test.
vi.mock('../pieces', () => ({ Treasure: () => null, PieceBase: () => null }));

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
    const Figure: ComponentType<PresetPieceProps> = () => null;
    registerRenderer('figure', Figure);
    const el = PresetPiece({ preset: 'holy-order', piece, jumping: false });
    expect(el.type).toBe(Figure);
    expect(el.props).toEqual({ preset: 'holy-order', piece, jumping: false });
    for (const preset of [
      'treasures',
      'dark-court',
      'gentlemen',
      'bunny-mages',
      'constellation',
    ] as const) {
      expect(PresetPiece({ preset, piece, jumping: false }).type).toBe(Treasure);
    }
  });
});
