import { Chess, type Move } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { trackPieces } from '../game/pieces';
import { movedKnights, squaresById } from './jumps';

/** The pieces after playing `sans` from the start. */
function after(...sans: string[]) {
  const chess = new Chess();
  const moves: Move[] = sans.map((san) => chess.move(san));
  return trackPieces(moves);
}

describe('movedKnights', () => {
  it('names the knight that just jumped', () => {
    expect(movedKnights(squaresById(after()), after('Nf3'))).toEqual(['wn-g1']);
  });

  it('names no one when anything else moves', () => {
    expect(movedKnights(squaresById(after('Nf3')), after('Nf3', 'e5'))).toEqual([]);
    expect(movedKnights(squaresById(after()), after())).toEqual([]);
  });

  it('rings a knight sent back by an undo, but not one whose old move is merely last again', () => {
    // Undo Nf3: the knight glides home.
    expect(movedKnights(squaresById(after('Nf3')), after())).toEqual(['wn-g1']);
    // Undo e5: Nf3 is the last move again, but that knight stays put.
    expect(movedKnights(squaresById(after('Nf3', 'e5')), after('Nf3'))).toEqual([]);
  });

  it('names every knight an undo of two plies moves', () => {
    expect(movedKnights(squaresById(after('Nf3', 'Nc6')), after()).sort()).toEqual([
      'bn-b8',
      'wn-g1',
    ]);
  });

  it('ignores a knight that was not on the board before, and captured pieces', () => {
    expect(movedKnights(new Map(), after('Nf3'))).toEqual([]);
    const before = squaresById(after('Nf3', 'e5', 'Nxe5'));
    // The black pawn on e5 is gone; the white knight did not move again.
    expect(movedKnights(before, after('Nf3', 'e5', 'Nxe5', 'd6'))).toEqual([]);
  });
});
