import type { Square } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { createGame } from '../../../game/game';
import { capturedPiece } from './captures';

/** The pieces before and after playing `moves` (from→to pairs) on top of `setup`. */
function play(setup: [Square, Square][], last: [Square, Square], fen?: string) {
  const game = createGame(fen);
  for (const [from, to] of setup) expect(game.move({ from, to })).toBe(true);
  const before = game.snapshot().pieces;
  expect(game.move({ from: last[0], to: last[1] })).toBe(true);
  return { game, before, after: game.snapshot().pieces };
}

describe('capturedPiece', () => {
  it('is null for a quiet move', () => {
    const { before, after } = play([], ['e2', 'e4']);
    expect(capturedPiece(before, after)).toBeNull();
  });

  it('is the piece taken, where it stood', () => {
    const { before, after } = play(
      [
        ['e2', 'e4'],
        ['d7', 'd5'],
      ],
      ['e4', 'd5'],
    );
    expect(capturedPiece(before, after)).toMatchObject({ type: 'p', color: 'b', square: 'd5' });
  });

  it('finds an en passant victim beside the square the pawn lands on', () => {
    const { before, after } = play(
      [
        ['e2', 'e4'],
        ['a7', 'a6'],
        ['e4', 'e5'],
        ['d7', 'd5'],
      ],
      ['e5', 'd6'],
    );
    expect(capturedPiece(before, after)).toMatchObject({ type: 'p', color: 'b', square: 'd5' });
  });

  it('is the piece taken by a promotion, not the pawn that became a queen', () => {
    const { before, after } = play([], ['b7', 'a8'], 'r3k3/1P6/8/8/8/8/8/4K3 w - - 0 1');
    expect(capturedPiece(before, after)).toMatchObject({ type: 'r', color: 'b', square: 'a8' });
  });

  it('is null for castling, where two pieces move and none is taken', () => {
    const { before, after } = play([], ['e1', 'g1'], 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(capturedPiece(before, after)).toBeNull();
  });

  it('is null when an undo brings a piece back', () => {
    const { game, after } = play(
      [
        ['e2', 'e4'],
        ['d7', 'd5'],
      ],
      ['e4', 'd5'],
    );
    game.undo(1);
    expect(capturedPiece(after, game.snapshot().pieces)).toBeNull();
  });
});
