import type { Square } from 'chess.js';
import type { MoveInput, PromotionPiece } from '../game/game';

const BEST = /^bestmove\s+(\S+)/;
const MOVE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

/** `undefined`: not a bestmove line. `null`: the engine has no move. */
export function parseBestMove(line: string): MoveInput | null | undefined {
  const best = BEST.exec(line.trim());
  if (!best) return undefined;
  const move = MOVE.exec(best[1]);
  if (!move) return null;
  const input: MoveInput = { from: move[1] as Square, to: move[2] as Square };
  if (move[3]) input.promotion = move[3] as PromotionPiece;
  return input;
}
