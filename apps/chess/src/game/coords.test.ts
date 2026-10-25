import { describe, expect, it } from 'vitest';
import { SQUARES, isLightSquare, squareToPosition } from './coords';

describe('coords', () => {
  it('lists 64 squares from a8 to h1', () => {
    expect(SQUARES).toHaveLength(64);
    expect(SQUARES[0]).toBe('a8');
    expect(SQUARES[63]).toBe('h1');
  });
  it('maps squares to board positions, white at +z', () => {
    expect(squareToPosition('a1')).toEqual([-3.5, 3.5]);
    expect(squareToPosition('h8')).toEqual([3.5, -3.5]);
    expect(squareToPosition('e4')).toEqual([0.5, 0.5]);
  });
  it('knows h1 is light and a1 is dark', () => {
    expect(isLightSquare('h1')).toBe(true);
    expect(isLightSquare('a1')).toBe(false);
  });
});
