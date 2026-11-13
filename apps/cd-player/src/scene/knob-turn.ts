import { angleDelta, foldTurn, knobSeekMs, knobTakesTurn } from './controls';
import { grips, type Grips } from './grip';

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

/** The knob's turns, fed the pointer events that concern them (grip.ts's rules). */
export type KnobTurns = Grips;

/** The turn of the knob that one pointer is making. */
interface Turn {
  /** The pointer's last angle around the knob (radians). */
  last: number;
  /** How far it has turned the knob since it went down (radians): the seek, once it lets go. */
  total: number;
  /** The knob's rotation when it went down, to give back if the turn is abandoned. */
  from: number;
}

/**
 * The knob's turns on `rig` (grip.ts keeps their rules): `angleAt` reads a pointer's angle around
 * the knob (radians), `seek` takes a finished turn's seek, and `follows` says that the disc follows
 * the turn (the profile's knobTurnsDisc). The knob takes a turn only while no change runs and the
 * door is shut (knobTakesTurn).
 */
export function knobTurns(
  rig: KnobRig,
  knob: KnobNode,
  follows: boolean,
  angleAt: (x: number, y: number) => number,
  seek: (deltaMs: number) => void,
): KnobTurns {
  // A turn that stops (a change began, the door opened) or is released ends where it stands: the
  // knob stays where the hand left it, the disc keeps the turn it followed (so a disc leaving the
  // spindle goes with that and no more), and the displays stop previewing.
  const end = () => {
    rig.spin = foldTurn(rig.spin, rig.knobTurn);
    rig.knobTurn = 0;
    rig.scrubMs = null;
  };
  return grips<Turn>({
    takes: () => knobTakesTurn(rig.doorOpen, rig.swapping),
    begin: (x, y) => ({ last: angleAt(x, y), total: 0, from: knob.rotation.y }),
    move: (turn, x, y) => {
      const angle = angleAt(x, y);
      const delta = angleDelta(turn.last, angle);
      turn.last = angle;
      turn.total += delta;
      knob.rotation.y -= delta;
      rig.scrubMs = knobSeekMs(turn.total);
      if (follows) rig.knobTurn = knob.rotation.y - turn.from;
    },
    release: (turn) => {
      end();
      const deltaMs = knobSeekMs(turn.total);
      if (deltaMs !== 0) seek(deltaMs);
    },
    // A turn that does not end in a release puts the knob back where it began and seeks nothing.
    abandon: (turn) => {
      knob.rotation.y = turn.from;
      rig.knobTurn = 0;
      rig.scrubMs = null;
    },
    // Its seek was in a track on its way out: none.
    stop: end,
  });
}
