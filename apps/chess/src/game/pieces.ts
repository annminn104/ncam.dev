import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import { SQUARES, type Side } from './coords';

export interface BoardPiece {
  id: string;
  square: Square;
  type: PieceSymbol;
  color: Side;
}

/**
 * The pieces on the board after `moves`, each with an id that follows it from
 * square to square — so the scene can animate a piece instead of remounting it.
 * Ids are assigned in board order from the start position, so replaying the
 * same history always yields the same ids (undo just replays fewer moves).
 */
export function trackPieces(moves: readonly Move[], startFen?: string): BoardPiece[] {
  const start = new Chess(startFen);
  const bySquare = new Map<Square, BoardPiece>();
  for (const sq of SQUARES) {
    const p = start.get(sq);
    if (p) {
      bySquare.set(sq, {
        id: `${p.color}${p.type}-${sq}`,
        square: sq,
        type: p.type,
        color: p.color,
      });
    }
  }
  for (const m of moves) {
    const piece = bySquare.get(m.from);
    if (!piece) continue;
    bySquare.delete(m.from);
    if (m.isEnPassant()) bySquare.delete(`${m.to[0]}${m.from[1]}` as Square);
    if (m.isKingsideCastle() || m.isQueensideCastle()) {
      const rank = m.from[1];
      const [rookFrom, rookTo] = m.isKingsideCastle() ? ['h', 'f'] : ['a', 'd'];
      const rook = bySquare.get(`${rookFrom}${rank}` as Square);
      if (rook) {
        bySquare.delete(rook.square);
        bySquare.set(`${rookTo}${rank}` as Square, {
          ...rook,
          square: `${rookTo}${rank}` as Square,
        });
      }
    }
    bySquare.set(m.to, { ...piece, square: m.to, type: m.promotion ?? piece.type });
  }
  return [...bySquare.values()];
}
