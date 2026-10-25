/**
 * A state initialiser for a treasure's animation phase, so pieces of a type do not move in step.
 * Animations compute their pose from the clock (plus this phase, or state kept in a ref) and
 * write it to the object whole every frame, never accumulating on the object itself: R3F
 * re-applies props down a piece's subtree when a move re-inserts it, and a whole write puts the
 * pose straight back.
 */
export const randomPhase = () => Math.random() * Math.PI * 2;
