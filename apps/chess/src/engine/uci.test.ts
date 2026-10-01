import { describe, expect, it } from 'vitest';
import { parseBestMove } from './uci';

describe('parseBestMove', () => {
  it('reads a plain move', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ from: 'e2', to: 'e4' });
  });
  it('reads a promotion', () => {
    expect(parseBestMove('bestmove e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
  });
  it('returns null when there is no move', () => {
    expect(parseBestMove('bestmove (none)')).toBeNull();
  });
  it('ignores other lines', () => {
    expect(parseBestMove('info depth 10 score cp 20')).toBeUndefined();
    expect(parseBestMove('uciok')).toBeUndefined();
  });
});
