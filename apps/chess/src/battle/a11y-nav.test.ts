import { describe, expect, it } from 'vitest';
import { createGame } from '../game/game';
import { describeSquare, isArrow, stepSquare } from './a11y-nav';

describe('stepSquare', () => {
  it('moves up the board from white’s view', () => {
    expect(stepSquare('e2', 'ArrowUp', 'w')).toBe('e3');
    expect(stepSquare('e2', 'ArrowRight', 'w')).toBe('f2');
  });
  it('flips directions from black’s view', () => {
    expect(stepSquare('e7', 'ArrowUp', 'b')).toBe('e6');
    expect(stepSquare('e7', 'ArrowRight', 'b')).toBe('d7');
  });
  it('stops at the edges', () => {
    expect(stepSquare('a8', 'ArrowUp', 'w')).toBe('a8');
    expect(stepSquare('a8', 'ArrowLeft', 'w')).toBe('a8');
  });
});

describe('isArrow', () => {
  it('accepts the four arrow keys only', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      expect(isArrow(key)).toBe(true);
    }
    for (const key of ['Enter', 'Escape', ' ', 'Tab', 'arrowup']) expect(isArrow(key)).toBe(false);
  });
});

describe('describeSquare', () => {
  it('names the piece and its sect on a square, by the owner’s piece set', () => {
    const pieces = createGame().snapshot().pieces;
    const presets = { w: 'treasures', b: 'treasures' } as const;
    expect(describeSquare('e1', pieces, presets)).toBe('e1, Righteous Sect Heaven Seal (King)');
    expect(describeSquare('e4', pieces, presets)).toBe('e4, empty');
    expect(describeSquare('e8', pieces, { w: 'treasures', b: 'holy-order' })).toBe(
      'e8, Demonic Sect Patriarch (King)',
    );
  });
  it('reads each piece from its own side’s set, not the other’s', () => {
    const pieces = createGame().snapshot().pieces;
    const presets = { w: 'holy-order', b: 'treasures' } as const;
    expect(describeSquare('d1', pieces, presets)).toBe('d1, Righteous Sect Saint Abbess (Queen)');
    expect(describeSquare('d8', pieces, presets)).toBe(
      'd8, Demonic Sect Flying Sword Ring (Queen)',
    );
  });
});
