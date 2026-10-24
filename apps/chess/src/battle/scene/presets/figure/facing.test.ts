import { describe, expect, it } from 'vitest';
import { figureTurn, sideYaw } from './facing';

// A figure's front is +z, and white's end of the board is +z (game/coords.ts): a yaw about +y looks
// at white's end when cos(yaw) is positive, and at black's end when it is negative.
const looksAt = (yaw: number) => (Math.cos(yaw) > 0 ? 'white' : 'black');

describe('figure facing', () => {
  it("turns white's figures to black's end and black's to white's in a game", () => {
    expect(looksAt(sideYaw('w') + figureTurn('opponent'))).toBe('black');
    expect(looksAt(sideYaw('b') + figureTurn('opponent'))).toBe('white');
  });

  it("keeps each figure on its owner's end in the lineup, where Battle turns black's round to the camera", () => {
    expect(looksAt(sideYaw('w') + figureTurn('owner'))).toBe('white');
    expect(looksAt(sideYaw('b') + figureTurn('owner'))).toBe('black');
    // Battle's lineup wrapper: black's pieces take another half turn, so every figure shows its face.
    expect(looksAt(sideYaw('b') + figureTurn('owner') + Math.PI)).toBe('white');
  });

  it("leaves each base reading from its owner's end", () => {
    expect(sideYaw('w')).toBe(0);
    expect(sideYaw('b')).toBe(Math.PI);
  });

  it('turns a figure on its base by a half turn or not at all', () => {
    expect(figureTurn('opponent')).toBe(Math.PI);
    expect(figureTurn('owner')).toBe(0);
  });
});
