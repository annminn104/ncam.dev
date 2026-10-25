import type { Chess } from 'chess.js';
import type { Side } from './coords';

export type GameStatus =
  | { kind: 'playing' }
  | { kind: 'checkmate'; winner: Side }
  | { kind: 'stalemate' }
  | { kind: 'threefold' }
  | { kind: 'fifty-move' }
  | { kind: 'insufficient' }
  | { kind: 'resigned'; winner: Side }
  | { kind: 'draw-agreed' };

/** The board's own verdict. Resignation and agreed draws are tracked by game.ts. */
export function statusOf(chess: Chess): GameStatus {
  if (chess.isCheckmate()) return { kind: 'checkmate', winner: chess.turn() === 'w' ? 'b' : 'w' };
  if (chess.isStalemate()) return { kind: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { kind: 'insufficient' };
  if (chess.isThreefoldRepetition()) return { kind: 'threefold' };
  // chess.js's isDraw() covers the rest: the fifty-move rule.
  if (chess.isDraw()) return { kind: 'fifty-move' };
  return { kind: 'playing' };
}

export function isOver(status: GameStatus): boolean {
  return status.kind !== 'playing';
}

const SIDE_NAME: Record<Side, string> = { w: 'Righteous Sect', b: 'Demonic Sect' };

export function describeStatus(status: GameStatus): string {
  switch (status.kind) {
    case 'playing':
      return '';
    case 'checkmate':
      return `Checkmate — the ${SIDE_NAME[status.winner]} prevails`;
    case 'resigned':
      return `Resignation — the ${SIDE_NAME[status.winner]} prevails`;
    case 'stalemate':
      return 'Stalemate — a draw';
    case 'threefold':
      return 'Threefold repetition — a draw';
    case 'fifty-move':
      return 'Fifty-move rule — a draw';
    case 'insufficient':
      return 'Insufficient material — a draw';
    case 'draw-agreed':
      return 'Draw agreed';
  }
}
