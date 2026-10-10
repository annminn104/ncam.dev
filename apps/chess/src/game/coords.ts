import type { Square } from 'chess.js';

export type Side = 'w' | 'b';
export const FILES = 'abcdefgh';

export const SQUARES: readonly Square[] = Array.from({ length: 64 }, (_, i) => {
  const file = FILES[i % 8];
  const rank = 8 - Math.floor(i / 8);
  return `${file}${rank}` as Square;
});

/** Board-space centre of a square: files along x, ranks along -z, white at +z. */
export function squareToPosition(sq: Square): [x: number, z: number] {
  const file = FILES.indexOf(sq[0]);
  const rank = Number(sq[1]);
  return [file - 3.5, 3.5 - (rank - 1)];
}

export function isLightSquare(sq: Square): boolean {
  const file = FILES.indexOf(sq[0]);
  const rank = Number(sq[1]);
  return (file + rank) % 2 === 0;
}
