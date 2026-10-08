import type { Side } from '../game/coords';
import type { GameStatus } from '../game/status';

/**
 * How many plies the HUD's Undo takes back now, or null when it is off. Hot-seat: one.
 * Vs the AI: the player's move and the AI's reply, so the player is to move again; when the
 * player's own move ended the game the AI never replied, so just that move. A resignation or an
 * agreed draw is a verdict, not a move: Undo takes back the verdict alone (0 plies).
 */
export function undoPlies(state: {
  hotseat: boolean;
  humanSide: Side;
  turn: Side;
  status: GameStatus;
  plyCount: number;
  thinking: boolean;
}): number | null {
  const { hotseat, humanSide, turn, status, plyCount, thinking } = state;
  if (thinking) return null;
  if (status.kind === 'resigned' || status.kind === 'draw-agreed') return 0;
  let plies: number;
  if (hotseat) plies = 1;
  else if (turn === humanSide) plies = 2;
  else if (status.kind !== 'playing') plies = 1;
  else return null;
  return plyCount >= plies ? plies : null;
}
