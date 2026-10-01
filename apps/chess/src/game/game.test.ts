import { describe, expect, it } from 'vitest';
import { createGame, type MoveInput } from './game';

const play = (game: ReturnType<typeof createGame>, moves: string[]) => {
  for (const m of moves) {
    const input: MoveInput = { from: m.slice(0, 2) as never, to: m.slice(2, 4) as never };
    if (m.length === 5) input.promotion = m[4] as MoveInput['promotion'];
    expect(game.move(input), m).toBe(true);
  }
};

describe('createGame', () => {
  it('starts with white to move and 32 pieces', () => {
    const s = createGame().snapshot();
    expect(s.turn).toBe('w');
    expect(s.pieces).toHaveLength(32);
    expect(s.status).toEqual({ kind: 'playing' });
  });

  it('lists legal targets and rejects illegal moves', () => {
    const game = createGame();
    expect(game.legalTargets('e2').sort()).toEqual(['e3', 'e4']);
    expect(game.legalTargets('e7')).toEqual([]); // not white's piece
    expect(game.move({ from: 'e2', to: 'e5' })).toBe(false);
    expect(game.snapshot().turn).toBe('w');
  });

  it('castles on both sides', () => {
    const k = createGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(k.move({ from: 'e1', to: 'g1' })).toBe(true);
    expect(k.snapshot().pieces.find((p) => p.square === 'f1')?.type).toBe('r');
    const q = createGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(q.move({ from: 'e1', to: 'c1' })).toBe(true);
    expect(q.snapshot().pieces.find((p) => p.square === 'd1')?.type).toBe('r');
  });

  it('refuses to castle through an attacked square', () => {
    const game = createGame('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
    const targets = game.legalTargets('e1');
    expect(targets).not.toContain('g1');
    expect(targets).toContain('c1');
  });

  it('captures en passant', () => {
    const game = createGame();
    play(game, ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']);
    const s = game.snapshot();
    expect(s.pieces.find((p) => p.square === 'd5')).toBeUndefined();
    expect(s.captured.b).toEqual(['p']);
  });

  it.each(['q', 'r', 'b', 'n'] as const)('promotes to %s', (piece) => {
    const game = createGame('8/P7/8/8/8/8/8/k6K w - - 0 1');
    expect(game.legalTargets('a7')).toEqual(['a8']);
    expect(game.isPromotion('a7', 'a8')).toBe(true);
    expect(game.isPromotion('h1', 'h2')).toBe(false);
    expect(game.move({ from: 'a7', to: 'a8', promotion: piece })).toBe(true);
    expect(game.snapshot().pieces.find((p) => p.square === 'a8')?.type).toBe(piece);
  });

  it("detects fool's mate and stops accepting moves", () => {
    const game = createGame();
    play(game, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    const s = game.snapshot();
    expect(s.status).toEqual({ kind: 'checkmate', winner: 'b' });
    expect(s.checkSquare).toBe('e1');
    expect(game.move({ from: 'a2', to: 'a3' })).toBe(false);
  });

  it('detects stalemate', () => {
    expect(createGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').snapshot().status).toEqual({
      kind: 'stalemate',
    });
  });

  it('detects threefold repetition', () => {
    const game = createGame();
    play(game, ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
    expect(game.snapshot().status).toEqual({ kind: 'threefold' });
  });

  it('detects the fifty-move rule', () => {
    const game = createGame('8/8/8/8/8/5k2/8/R3K3 w - - 99 60');
    play(game, ['a1a2']);
    expect(game.snapshot().status).toEqual({ kind: 'fifty-move' });
  });

  it('detects insufficient material', () => {
    expect(createGame('8/8/8/8/8/5k2/8/4KN2 w - - 0 1').snapshot().status).toEqual({
      kind: 'insufficient',
    });
  });

  it('undoes one and two plies', () => {
    const game = createGame();
    play(game, ['e2e4', 'e7e5', 'g1f3']);
    game.undo(1);
    expect(game.plyCount()).toBe(2);
    expect(game.snapshot().turn).toBe('w');
    game.undo(2);
    expect(game.plyCount()).toBe(0);
    expect(game.snapshot().lastMove).toBeNull();
  });

  it('records resignation and agreed draws', () => {
    const r = createGame();
    r.resign('w');
    expect(r.snapshot().status).toEqual({ kind: 'resigned', winner: 'b' });
    expect(r.move({ from: 'e2', to: 'e4' })).toBe(false);
    const d = createGame();
    d.agreeDraw();
    expect(d.snapshot().status).toEqual({ kind: 'draw-agreed' });
  });

  it('undo after resignation reopens the game', () => {
    const game = createGame();
    play(game, ['e2e4']);
    game.resign('b');
    game.undo(1);
    expect(game.snapshot().status).toEqual({ kind: 'playing' });
  });
});
