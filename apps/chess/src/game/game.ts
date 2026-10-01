import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { Side } from './coords';
import { trackPieces, type BoardPiece } from './pieces';
import { isOver, statusOf, type GameStatus } from './status';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

export interface GameSnapshot {
  fen: string;
  turn: Side;
  sanHistory: string[];
  lastMove: { from: Square; to: Square } | null;
  checkSquare: Square | null;
  pieces: BoardPiece[];
  captured: { w: PieceSymbol[]; b: PieceSymbol[] };
  status: GameStatus;
}

export interface Game {
  snapshot(): GameSnapshot;
  legalTargets(from: Square): Square[];
  isPromotion(from: Square, to: Square): boolean;
  move(input: MoveInput): boolean;
  undo(plies: number): void;
  resign(side: Side): void;
  agreeDraw(): void;
  plyCount(): number;
}

/** The rules API: every legality decision in the app goes through here. */
export function createGame(fen?: string): Game {
  const chess = new Chess(fen);
  // A verdict the board cannot see: resignation or an agreed draw. Cleared by undo.
  let override: GameStatus | null = null;

  const status = (): GameStatus => override ?? statusOf(chess);

  const kingSquare = (side: Side): Square | null => {
    for (const row of chess.board()) {
      for (const cell of row) {
        if (cell && cell.type === 'k' && cell.color === side) return cell.square;
      }
    }
    return null;
  };

  return {
    snapshot() {
      const history = chess.history({ verbose: true }) as Move[];
      const last = history.at(-1);
      const captured: GameSnapshot['captured'] = { w: [], b: [] };
      for (const m of history) {
        if (m.captured) captured[m.color === 'w' ? 'b' : 'w'].push(m.captured);
      }
      return {
        fen: chess.fen(),
        turn: chess.turn(),
        sanHistory: history.map((m) => m.san),
        lastMove: last ? { from: last.from, to: last.to } : null,
        checkSquare: chess.inCheck() ? kingSquare(chess.turn()) : null,
        pieces: trackPieces(history, fen),
        captured,
        status: status(),
      };
    },
    legalTargets(from) {
      if (isOver(status())) return [];
      return (chess.moves({ square: from, verbose: true }) as Move[]).map((m) => m.to);
    },
    isPromotion(from, to) {
      return (chess.moves({ square: from, verbose: true }) as Move[]).some(
        (m) => m.to === to && m.promotion !== undefined,
      );
    },
    move(input) {
      if (isOver(status())) return false;
      try {
        chess.move({ from: input.from, to: input.to, promotion: input.promotion ?? 'q' });
        return true;
      } catch {
        return false;
      }
    },
    undo(plies) {
      override = null;
      for (let i = 0; i < plies; i++) if (!chess.undo()) break;
    },
    resign(side) {
      if (!isOver(status())) override = { kind: 'resigned', winner: side === 'w' ? 'b' : 'w' };
    },
    agreeDraw() {
      if (!isOver(status())) override = { kind: 'draw-agreed' };
    },
    plyCount() {
      return chess.history().length;
    },
  };
}
