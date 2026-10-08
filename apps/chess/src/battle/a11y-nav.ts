import type { Square } from 'chess.js';
import { FILES, type Side } from '../game/coords';
import type { BoardPiece } from '../game/pieces';
import { SECTS, TREASURES } from '../game/treasures';

// The keyboard board's arithmetic, free of React and three so it runs under Node tests.

export type Arrow = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

export function isArrow(key: string): key is Arrow {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
}

/** The square an arrow key leads to, as seen from `viewSide`'s end of the board; edges hold. */
export function stepSquare(from: Square, key: Arrow, viewSide: Side): Square {
  const flip = viewSide === 'w' ? 1 : -1;
  let file = FILES.indexOf(from[0]);
  let rank = Number(from[1]);
  if (key === 'ArrowUp') rank += flip;
  if (key === 'ArrowDown') rank -= flip;
  if (key === 'ArrowRight') file += flip;
  if (key === 'ArrowLeft') file -= flip;
  file = Math.min(7, Math.max(0, file));
  rank = Math.min(8, Math.max(1, rank));
  return `${FILES[file]}${rank}` as Square;
}

/** What a screen reader hears for a square: "e1, Righteous Sect Heaven Seal (King)". */
export function describeSquare(sq: Square, pieces: BoardPiece[]): string {
  const p = pieces.find((x) => x.square === sq);
  if (!p) return `${sq}, empty`;
  const t = TREASURES[p.type];
  return `${sq}, ${SECTS[p.color]} ${t.name} (${t.piece})`;
}
