import { describe, expect, it } from 'vitest';
import { NO_OFFER, offerIn, positionKey, type DrawOffer } from './draw-offer';

const playing = { kind: 'playing' } as const;

describe('draw offers', () => {
  const at1 = positionKey(1, playing);
  const made: DrawOffer = { by: 'b', position: at1 };

  it('stands in the position it was made in', () => {
    expect(offerIn(made, at1)).toBe(made);
  });

  it('is withdrawn by a move, and an undo back to that position does not bring it back', () => {
    let offer = offerIn(made, positionKey(2, playing)); // the offering side moves on
    expect(offer.by).toBeNull();
    offer = offerIn(offer, at1); // undo
    expect(offer.by).toBeNull();
  });

  it('is withdrawn by an undo, and a different move at the same ply does not revive it', () => {
    let offer = offerIn(made, positionKey(0, playing)); // undo
    expect(offer.by).toBeNull();
    offer = offerIn(offer, positionKey(1, playing)); // another move
    expect(offer.by).toBeNull();
  });

  it('is withdrawn by any verdict, and by taking the verdict back', () => {
    const resigned = offerIn(made, positionKey(1, { kind: 'resigned', winner: 'w' }));
    expect(resigned.by).toBeNull();
    expect(offerIn(resigned, at1).by).toBeNull();
  });

  it('starts with none', () => {
    expect(NO_OFFER.by).toBeNull();
    expect(offerIn(NO_OFFER, at1).by).toBeNull();
  });
});
