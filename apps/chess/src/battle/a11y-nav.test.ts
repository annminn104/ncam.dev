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
  it('names the treasure and the piece on a square', () => {
    const pieces = createGame().snapshot().pieces;
    expect(describeSquare('e1', pieces)).toBe('e1, Righteous Sect Heaven Seal (King)');
    expect(describeSquare('e4', pieces)).toBe('e4, empty');
  });
});
