import type { BoardPiece } from '../../../game/pieces';

/**
 * The piece the last change of position took off the board, as it stood before (its square and
 * its sect), or null. Piece ids follow pieces from square to square (trackPieces), so a capture
 * is the one id that disappears. That finds an en passant victim beside the square the pawn
 * lands on, and a promotion keeps its pawn's id; a move, castling or an undo takes no id away.
 */
export function capturedPiece(
  before: readonly BoardPiece[],
  after: readonly BoardPiece[],
): BoardPiece | null {
  if (after.length >= before.length) return null;
  const left = new Set(after.map((p) => p.id));
  return before.find((p) => !left.has(p.id)) ?? null;
}
