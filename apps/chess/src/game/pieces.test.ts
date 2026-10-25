import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { trackPieces } from './pieces';

const verbose = (sans: string[], fen?: string) => {
  const c = new Chess(fen);
  return sans.map((san) => c.move(san));
};

describe('trackPieces', () => {
  it('gives every starting piece a stable id', () => {
    const start = trackPieces([]);
    expect(start).toHaveLength(32);
    expect(new Set(start.map((p) => p.id)).size).toBe(32);
  });
  it('keeps the id of a piece as it moves', () => {
    const before = trackPieces([]).find((p) => p.square === 'g1')!;
    const after = trackPieces(verbose(['Nf3'])).find((p) => p.square === 'f3')!;
    expect(after.id).toBe(before.id);
  });
  it('moves the rook id when castling', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const rook = trackPieces([], fen).find((p) => p.square === 'h1')!;
    const after = trackPieces(verbose(['O-O'], fen), fen).find((p) => p.square === 'f1')!;
    expect(after.id).toBe(rook.id);
  });
  it('removes the pawn taken en passant', () => {
    const pieces = trackPieces(verbose(['e4', 'a6', 'e5', 'd5', 'exd6']));
    expect(pieces).toHaveLength(31);
    expect(pieces.find((p) => p.square === 'd5')).toBeUndefined();
  });
  it('keeps the id and changes the type on promotion', () => {
    const fen = '8/P7/8/8/8/8/8/k6K w - - 0 1';
    const pawn = trackPieces([], fen).find((p) => p.square === 'a7')!;
    const queen = trackPieces(verbose(['a8=Q'], fen), fen).find((p) => p.square === 'a8')!;
    expect(queen.id).toBe(pawn.id);
    expect(queen.type).toBe('q');
  });
});
