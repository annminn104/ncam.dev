import { describe, expect, it } from 'vitest';
import { LINEUP_FEN, parseCapture } from './capture';
import { createGame } from './game/game';

describe('parseCapture', () => {
  it('is no capture without a known arena', () => {
    expect(parseCapture('')).toBeNull();
    expect(parseCapture('?capture=mars')).toBeNull();
  });

  it('takes an arena alone as its preview', () => {
    expect(parseCapture('?capture=cloud-peak')).toEqual({
      arena: 'cloud-peak',
      preset: 'treasures',
      lineup: false,
      view: null,
      quality: 'high',
    });
  });

  it('reads the piece-set and review options, ready presets or not', () => {
    expect(
      parseCapture('?capture=lotus-lake&preset=holy-order&lineup&view=orbit&quality=low'),
    ).toEqual({
      arena: 'lotus-lake',
      preset: 'holy-order',
      lineup: true,
      view: 'orbit',
      quality: 'low',
    });
    expect(parseCapture('?capture=cloud-peak&preset=dark-court')?.preset).toBe('dark-court');
  });

  it('ignores values it does not know', () => {
    expect(parseCapture('?capture=blood-moon&preset=mars&view=top&quality=ultra')).toEqual({
      arena: 'blood-moon',
      preset: 'treasures',
      lineup: false,
      view: null,
      quality: 'high',
    });
  });
});

describe('LINEUP_FEN', () => {
  it("lines up each side's six types in a quiet position", () => {
    const snap = createGame(LINEUP_FEN).snapshot();
    for (const side of ['w', 'b'] as const) {
      const types = snap.pieces.filter((p) => p.color === side).map((p) => p.type);
      expect(types.sort()).toEqual(['b', 'k', 'n', 'p', 'q', 'r']);
    }
    expect(snap.status.kind).toBe('playing');
    expect(snap.checkSquare).toBeNull();
  });
});
