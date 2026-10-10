import { describe, expect, it } from 'vitest';
import type { Side } from '../game/coords';
import type { GameStatus } from '../game/status';
import { undoPlies } from './undo';

const playing: GameStatus = { kind: 'playing' };

const at = (over: {
  hotseat?: boolean;
  humanSide?: Side;
  turn: Side;
  status?: GameStatus;
  plyCount: number;
  thinking?: boolean;
}) =>
  undoPlies({
    hotseat: false,
    humanSide: 'w',
    status: playing,
    thinking: false,
    ...over,
  });

describe('undoPlies, hot-seat', () => {
  it('takes back one ply', () => {
    expect(at({ hotseat: true, turn: 'b', plyCount: 1 })).toBe(1);
    expect(at({ hotseat: true, turn: 'w', plyCount: 2 })).toBe(1);
  });
  it('has nothing to take back before the first move', () => {
    expect(at({ hotseat: true, turn: 'w', plyCount: 0 })).toBeNull();
  });
  it('takes back the mating move', () => {
    const mate: GameStatus = { kind: 'checkmate', winner: 'b' };
    expect(at({ hotseat: true, turn: 'w', status: mate, plyCount: 4 })).toBe(1);
  });
});

describe('undoPlies, vs the AI', () => {
  it('takes back the player’s move and the reply on the player’s turn', () => {
    expect(at({ turn: 'w', plyCount: 2 })).toBe(2);
    expect(at({ humanSide: 'b', turn: 'b', plyCount: 3 })).toBe(2);
  });
  it('cannot take back the AI’s opening move on its own', () => {
    expect(at({ humanSide: 'b', turn: 'b', plyCount: 1 })).toBeNull();
  });
  it('waits while the AI is to move', () => {
    expect(at({ turn: 'b', plyCount: 1 })).toBeNull();
  });
  it('is off while the AI thinks', () => {
    expect(at({ turn: 'w', plyCount: 2, thinking: true })).toBeNull();
  });
  it('takes back only the player’s move when that move ended the game', () => {
    const mate: GameStatus = { kind: 'checkmate', winner: 'w' };
    expect(at({ turn: 'b', status: mate, plyCount: 5 })).toBe(1);
    expect(at({ turn: 'b', status: { kind: 'stalemate' }, plyCount: 9 })).toBe(1);
  });
  it('takes back the AI’s mate and the move before it', () => {
    const mate: GameStatus = { kind: 'checkmate', winner: 'b' };
    expect(at({ turn: 'w', status: mate, plyCount: 4 })).toBe(2);
  });
});

describe('undoPlies, verdicts', () => {
  const resigned: GameStatus = { kind: 'resigned', winner: 'w' };
  it('takes back a resignation and leaves the moves alone', () => {
    expect(at({ hotseat: true, turn: 'b', status: resigned, plyCount: 6 })).toBe(0);
    expect(at({ hotseat: true, turn: 'w', status: resigned, plyCount: 0 })).toBe(0);
    expect(at({ humanSide: 'b', turn: 'b', status: resigned, plyCount: 3 })).toBe(0);
  });
  it('takes back an agreed draw and leaves the moves alone', () => {
    expect(at({ hotseat: true, turn: 'w', status: { kind: 'draw-agreed' }, plyCount: 8 })).toBe(0);
  });
  it('still waits for a thinking AI', () => {
    expect(at({ turn: 'b', status: resigned, plyCount: 3, thinking: true })).toBeNull();
  });
});
