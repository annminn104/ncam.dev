import type { Side } from '../game/coords';
import type { GameStatus } from '../game/status';

/** A hot-seat draw offer (`by` the side that made it, or null) and the position it stands in. */
export interface DrawOffer {
  by: Side | null;
  position: string;
}

export const NO_OFFER: DrawOffer = { by: null, position: '' };

/** Changes with every move, undo, verdict and taken-back verdict. */
export function positionKey(plyCount: number, status: GameStatus): string {
  return `${plyCount} ${status.kind}`;
}

/**
 * The offer once the game is at `position`. An offer stands only in the position it was made in:
 * the first change withdraws it for good, so an undo back to that position, or another move at
 * the same ply, never brings it back. The caller must show this every position it reaches.
 */
export function offerIn(offer: DrawOffer, position: string): DrawOffer {
  return offer.position === position ? offer : { by: null, position };
}
