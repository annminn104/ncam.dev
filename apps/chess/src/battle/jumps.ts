import type { Square } from 'chess.js';
import type { BoardPiece } from '../game/pieces';

/** How long a knight's bell rings once it leaves its square: its glide (350 ms) and a beat. */
export const JUMP_MS = 400;

/** Where each piece stands, by id. */
export function squaresById(pieces: readonly BoardPiece[]): Map<string, Square> {
  return new Map(pieces.map((p) => [p.id, p.square]));
}

/**
 * The knights standing somewhere other than they did in `before`: the ones jumping now. By square
 * change rather than by the last move, so a knight sent back by an undo rings too, and one that
 * did not move does not ring when an undo makes its old move the last one again.
 */
export function movedKnights(
  before: ReadonlyMap<string, Square>,
  pieces: readonly BoardPiece[],
): string[] {
  return pieces
    .filter((p) => p.type === 'n' && before.has(p.id) && before.get(p.id) !== p.square)
    .map((p) => p.id);
}
