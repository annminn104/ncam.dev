import { angleDelta, foldTurn, knobSeekMs, knobTakesTurn, pinchedSince } from './controls';

/** What a turn of the knob reads and moves on the rig (rig.ts's Rig). */
export interface KnobRig {
  /** The disc's spin (radians): a finished turn the disc followed is folded into it. */
  spin: number;
  /** How far the disc follows the turn going on (radians); 0 between turns. */
  knobTurn: number;
  /** The turn's seek (ms) while one goes on, for the displays; else null. */
  scrubMs: number | null;
  /** How far the door stood open at the last pose: 0 shut … 1 open. */
  doorOpen: number;
  /** A change is running (a disc leaving, arriving or moving in the rack). */
  swapping: boolean;
}

/** The knob's own turn (its node's rotation about its axis), which a turn moves. */
export interface KnobNode {
  rotation: { y: number };
}

/** The turn of the knob that one pointer is making. */
interface Turn {
  id: number;
  /** The pointer's last angle around the knob (radians). */
  last: number;
  /** How far it has turned the knob since it went down (radians): the seek, once it lets go. */
  total: number;
  /** The knob's rotation when it went down, to give back if the turn is abandoned. */
  from: number;
  /** interaction.pinches as it went down: a turn that becomes a pinch is abandoned. */
  pinches: number;
}

/** The knob's turns, fed the pointer events that concern them. */
export interface KnobTurns {
  /** A press on the knob at (x, y), `pinches` pinches begun so far: a turn begins if it takes one. */
  down(id: number, x: number, y: number, pinches: number): void;
  /** A pointer moves; `lost` says that its release was lost (interaction.ts releaseLost). */
  move(id: number, x: number, y: number, pinches: number, lost: boolean): void;
  /** A pointer lifts: its turn, if it is still one, seeks by how far it went. */
  up(id: number, pinches: number): void;
  /** A pointer is cancelled: its turn seeks nothing. */
  cancel(id: number): void;
  /** Every frame: a turn the knob no longer takes ends where it stands, even with no pointer event. */
  frame(): void;
}

/**
 * The knob's turns on `rig`: `angleAt` reads a pointer's angle around the knob (radians), `seek`
 * takes a finished turn's seek, and `follows` says that the disc follows the turn (the profile's
 * knobTurnsDisc). The knob takes a turn only while no change runs and the door is shut
 * (knobTakesTurn), and that is checked for as long as the turn goes on, not only as it begins: a
 * track that ends mid-turn swaps the very disc the turn scrubs.
 */
export function knobTurns(
  rig: KnobRig,
  knob: KnobNode,
  follows: boolean,
  angleAt: (x: number, y: number) => number,
  seek: (deltaMs: number) => void,
): KnobTurns {
  let turning: Turn | null = null;

  // A turn that does not end in a release (cancelled, its release lost, or become a pinch) puts
  // the knob back where it began and seeks nothing.
  const abandon = (turn: Turn) => {
    knob.rotation.y = turn.from;
    rig.knobTurn = 0;
    rig.scrubMs = null;
    turning = null;
  };

  // A turn the knob no longer takes (a change began, the door opened) stops where it stands: the
  // knob stays where the hand left it, the disc keeps the turn it followed (so a disc leaving the
  // spindle goes with that and no more), the displays stop previewing, and it seeks nothing, since
  // its seek was in a track on its way out.
  const end = () => {
    rig.spin = foldTurn(rig.spin, rig.knobTurn);
    rig.knobTurn = 0;
    rig.scrubMs = null;
    turning = null;
  };

  // The pointer's turn, if it has one the knob still takes (ending it otherwise).
  const mine = (id: number): Turn | null => {
    if (turning?.id !== id) return null;
    if (knobTakesTurn(rig.doorOpen, rig.swapping)) return turning;
    end();
    return null;
  };

  return {
    down(id, x, y, pinches) {
      // The deck's jog is its door: lifted for a swap, it turns nothing.
      if (!knobTakesTurn(rig.doorOpen, rig.swapping)) return;
      turning = { id, last: angleAt(x, y), total: 0, from: knob.rotation.y, pinches };
    },
    move(id, x, y, pinches, lost) {
      const turn = mine(id);
      if (!turn) return;
      if (lost || pinchedSince(turn.pinches, pinches)) {
        abandon(turn);
        return;
      }
      const angle = angleAt(x, y);
      const delta = angleDelta(turn.last, angle);
      turn.last = angle;
      turn.total += delta;
      knob.rotation.y -= delta;
      rig.scrubMs = knobSeekMs(turn.total);
      if (follows) rig.knobTurn = knob.rotation.y - turn.from;
    },
    up(id, pinches) {
      const turn = mine(id);
      if (!turn) return;
      if (pinchedSince(turn.pinches, pinches)) {
        abandon(turn);
        return;
      }
      end();
      const deltaMs = knobSeekMs(turn.total);
      if (deltaMs !== 0) seek(deltaMs);
    },
    cancel(id) {
      const turn = mine(id);
      if (turn) abandon(turn);
    },
    frame() {
      if (turning) mine(turning.id);
    },
  };
}
