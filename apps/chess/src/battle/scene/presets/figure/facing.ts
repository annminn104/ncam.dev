import { createContext } from 'react';
import type { Side } from '../../../../game/coords';

/**
 * Where a set's figures look: at the other end of the board, as the two armies do in a game, or at
 * their owner's end, which is how the lineup shows them (Battle turns black's side round to the
 * camera there, so every figure shows its face).
 */
export type FigureFacing = 'opponent' | 'owner';

/** Battle provides it: figures face their opponent, unless a capture's lineup asks for the owner. */
export const FigureFacingContext = createContext<FigureFacing>('opponent');

/**
 * The yaw about +y of a side's group, its base and the figure on it. A figure's front is +z, white's
 * end of the board (game/coords.ts), so black's end is turned: each base, with its glyph, reads from
 * its owner's seat.
 */
export function sideYaw(color: Side): number {
  return color === 'b' ? Math.PI : 0;
}

/**
 * The yaw of a figure on its base, inside its side's group. That group already faces the figure's
 * owner's end, so facing the other end is a half turn on from there, whichever side it is.
 */
export function figureTurn(facing: FigureFacing): number {
  return facing === 'opponent' ? Math.PI : 0;
}
