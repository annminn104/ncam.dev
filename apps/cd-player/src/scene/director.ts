import type { TrackView } from '../bridge';
import type { Status } from '../playback/sequencer';
import {
  DISC_COPIES,
  RACK_SLOTS,
  sizeFor,
  type ChangeOf,
  type Place,
  type PrintSize,
  type Shelf,
  type Target,
} from './stage';

/**
 * The disc changes as plans of moves and pure functions of time (ms), so node tests can walk
 * them; the rig turns a pose into transforms (src/scene/rig.ts). A change moves the rig's disc
 * copies between the spindle, the rack's five slots in the lid and out of sight, turns the case
 * over for a new booklet, and swings the arm. Slot 0, the next to play, is the lowest and the
 * frontmost; each slot above stands behind the one below it, so the queue advancing ("the rack
 * moves up") moves each disc one slot down the lid, and a rack disc leaves or arrives by
 * shrinking or growing in its own slot. The case turns only while no disc flies to or from the
 * spindle.
 *
 * first (1.6 s): slot 0's disc flies down onto the spindle, the discs behind it each move a slot
 *   nearer, a new disc grows into slot 4 (the top), the arm swings in and lowers.
 * next (2.8 s, a track's natural end too): the arm lifts and swings to its rest, the spindle's
 *   disc rises and flies aside, shrinking away, slot 0's disc flies down, the rack advances and a
 *   new disc grows into slot 4, the case turns over and back to show the new booklet, the arm
 *   swings in and lowers.
 * prev (2.8 s): the reverse: slot 4's disc shrinks away and the rack moves back a slot (the top
 *   disc first), the spindle's disc goes back into slot 0, the previous track's disc comes in from
 *   the side onto the spindle.
 * pick (2.8 s): a disc further up the rack flies from its slot once the discs in front of it have
 *   shrunk away; the ones behind it close the gap and new ones grow in above them.
 * side (2.8 s): a track the rack does not hold comes in from the side; the slots whose track
 *   changes reprint with a short cascade, out then in.
 * cascade (1.6 s): a view that changed with no swap (a new collection, Shuffle, Repeat): the
 *   changed slots shrink and new discs grow in, a slot at a time; the spindle's disc leaves when
 *   nothing is in the player any more, and the arm holds its pose otherwise.
 */
export type Timeline = 'first' | 'next' | 'prev' | 'pick' | 'side' | 'cascade';

/** The tonearm's angle about its pivot (three's Y): over the disc, and at its rest. */
export const ARM_PLAY = -0.52;
export const ARM_REST = 0;

export const DURATION: Readonly<Record<Timeline, number>> = {
  first: 1600,
  next: 2800,
  prev: 2800,
  pick: 2800,
  side: 2800,
  cascade: 1600,
};

/** The case's turn: it rises, turns over, turns back and settles, FLIP_LIFT_MS at each end. */
export const FLIP_MS = 900;
const FLIP_LIFT_MS = 200;
/** The booklet's print changes as the case passes edge-on on its way over, this far in. */
export const FLIP_EDGE_MS = FLIP_LIFT_MS + (FLIP_MS / 2 - FLIP_LIFT_MS) / 2;
/** A copy that went out of sight shows again no sooner than this, so its new print is on it. */
export const PRINT_LEAD_MS = 200;
/** Between the discs of one move up or down the rack, and between those of one cascade. */
const SHIFT_GAP_MS = 60;
const CASCADE_GAP_MS = 90;
/** At a change's start the arm swings to its rest over the first, lifting over the second. */
const ARM_AWAY: Span = [0, 400];
const ARM_LIFT_OFF: Span = [0, 500];
/** An arm this close to its rest counts as resting: nothing to lift off. */
const ARM_EPSILON = 1e-3;

type Span = readonly [start: number, end: number];

/** A disc copy's way through a change: from a place to a place; null is out of sight. */
export interface DiscMove {
  disc: number;
  /** Null: it grows in from out of sight. */
  from: Place | null;
  /** Null: it shrinks away out of sight. */
  to: Place | null;
  start: number;
  end: number;
}

/** A print a change asks for: `view` on copy `disc`, `size` px; `at` ms in, 0 before it starts. */
export interface PrintOrder {
  disc: number;
  view: TrackView;
  size: PrintSize;
  at: number;
}

export interface ArmPlan {
  /** Where the arm and the spin start: where the last pose left them. */
  from: number;
  spinFrom: number;
  /** It starts on a disc, so it lifts off as it swings to its rest. */
  off: boolean;
  /** When its swing away starts: 0, or later for a plan that waits for a door. */
  at: number;
  /** When it swings back in and lowers onto the new disc; null when nothing lands. */
  back: Span | null;
  /**
   * How lifted it starts (the last pose's lift): a turntable's paused or dragged arm swings away
   * lifted.
   */
  liftFrom: number;
}

export interface Plan {
  timeline: Timeline;
  duration: number;
  /** Every copy shown during the change, at rest or moving; a reused copy has two moves. */
  moves: DiscMove[];
  prints: PrintOrder[];
  /** The case's turn for a new booklet (printed on its hidden side first); null if it stays. */
  flip: { start: number; end: number; booklet: TrackView | null } | null;
  /** Null: the arm holds its resting pose (Shuffle or Repeat with the disc left on the spindle). */
  arm: ArmPlan | null;
  /** The door's swing, for a model with one; null: it stays shut (or there is none). */
  door: DoorPlan | null;
  /** The shelf once the change is over. */
  after: Shelf;
}

export interface DiscPose {
  from: Place | null;
  to: Place | null;
  /** 0 at `from` … 1 at `to`, eased. */
  along: number;
}

export interface ArmPose {
  armAngle: number;
  armLift: number;
  /** Disc spin, as a share of full speed. */
  spin: number;
}

export interface Pose extends ArmPose {
  /** Each copy's pose; null while it is out of sight. */
  discs: (DiscPose | null)[];
  /** The case risen out of its seat, 0 … 1. */
  caseLift: number;
  /** The case turned over, 0 … 1 (1: its back to the visitor). */
  caseTurn: number;
  /** The booklet shows the turn's new print. */
  bookletNew: boolean;
  /** The door open, 0 (shut) … 1 (all the way); 0 for a model with none. */
  door: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
/** 0 before `a`, eased to 1 at `b`. */
const span = (t: number, a: number, b: number) => ease((t - a) / (b - a));
/** 0 → 1 → 0 between `a` and `b`. */
const bump = (t: number, a: number, b: number) => Math.sin(Math.PI * clamp01((t - a) / (b - a)));
/** The `order`-th of a run of moves, `gap` ms apart. */
const nth = (first: Span, order: number, gap: number): Span => [
  first[0] + order * gap,
  first[1] + order * gap,
];
const sameTrack = (a: TrackView | null | undefined, b: TrackView | null | undefined) =>
  (a?.id ?? null) === (b?.id ?? null);

/** When each part of a timeline moves (a run's first; the rest follow 60 or 90 ms apart). */
interface Timing {
  /** The spindle's disc rises and flies aside. */
  spindleOut: Span;
  /** A disc flies onto the spindle: from its slot, or in from the side. */
  land: Span;
  /** The spindle's disc goes back into slot 0. */
  back: Span;
  /** The rack's discs move up or down. */
  shift: Span;
  /** Rack discs leave their slots. */
  slotOut: Span;
  /** New discs grow into slots. */
  slotIn: Span;
  /** The case starts to turn. */
  flip: number;
  /** The arm swings back in (its lift bumps 50 ms either side). */
  armIn: Span;
}

// A disc takes off from a slot towards the spindle only once the slots in front of it are empty,
// one moves into a slot only once its disc has gone, and the case turns only while no disc flies
// to or from the spindle (src/scene/director.test.ts walks every timeline for these).
const TIMING: Readonly<Record<Timeline, Timing>> = {
  first: {
    spindleOut: [0, 400],
    land: [100, 800],
    back: [100, 800],
    shift: [450, 800],
    slotOut: [450, 800],
    slotIn: [1000, 1350],
    flip: 700,
    armIn: [1150, 1500],
  },
  next: {
    spindleOut: [450, 1050],
    land: [900, 1600],
    back: [900, 1600],
    shift: [1250, 1600],
    slotOut: [1250, 1600],
    slotIn: [1850, 2200],
    flip: 1600,
    armIn: [2400, 2750],
  },
  prev: {
    spindleOut: [450, 1050],
    land: [1700, 2350],
    back: [1200, 1900],
    shift: [700, 1000],
    slotOut: [400, 700],
    slotIn: [1850, 2200],
    flip: 300,
    armIn: [2400, 2750],
  },
  pick: {
    spindleOut: [450, 1050],
    land: [900, 1600],
    back: [900, 1600],
    shift: [1250, 1650],
    slotOut: [300, 600],
    slotIn: [1700, 2050],
    flip: 1600,
    armIn: [2400, 2750],
  },
  side: {
    spindleOut: [450, 1050],
    land: [1100, 1800],
    back: [1100, 1800],
    shift: [1250, 1600],
    slotOut: [450, 800],
    slotIn: [1500, 1850],
    flip: 1800,
    armIn: [2400, 2750],
  },
  cascade: {
    spindleOut: [450, 1050],
    land: [1100, 1800],
    back: [1100, 1800],
    shift: [0, 350],
    slotOut: [0, 350],
    slotIn: [800, 1150],
    flip: 1050,
    armIn: [2400, 2750],
  },
};

/** The timeline a change takes on this shelf; a reading the shelf cannot play comes from the side. */
function timelineFor(change: ChangeOf, shelf: Shelf, target: Target): Timeline {
  const fromRack = change.slot !== null && shelf.rack[change.slot] !== null;
  switch (change.kind) {
    case 'first':
    case 'next':
      if (!fromRack) return 'side';
      return shelf.spindle === null ? 'first' : 'next';
    case 'pick':
      return fromRack ? 'pick' : 'side';
    case 'prev':
      return shelf.spindle === null ? 'side' : 'prev';
    case 'side':
      return 'side';
    case 'collection':
    case 'restack': {
      const held = shelf.spindle === null ? null : shelf.tracks[shelf.spindle];
      return target.current && !sameTrack(held, target.current) ? 'side' : 'cascade';
    }
  }
}

/**
 * The plan for a change from what `shelf` holds to `target`, read as `change`; `last` is where
 * the last pose left the arm and the spin. Every plan ends with the shelf exactly as `target`
 * says: a slot whose incoming disc does not hold its track gets a new disc, on a copy out of sight
 * by then (a spare one, else one this change sends away, PRINT_LEAD_MS before it shows again).
 * `options.booklet` false: the model has no jewel case (a turntable), so no booklet turns and the
 * plan keeps its own length.
 */
export function planChange(
  change: ChangeOf,
  shelf: Shelf,
  target: Target,
  last: { armAngle: number; spin: number; armLift?: number },
  options?: { door?: boolean; booklet?: boolean },
): Plan {
  const timeline = timelineFor(change, shelf, target);
  const timing = TIMING[timeline];
  const tracks = shelf.tracks.slice();
  const rack: (number | null)[] = Array.from({ length: RACK_SLOTS }, () => null);
  const moves: DiscMove[] = [];
  const prints: PrintOrder[] = [];
  /** The copies this change sends out of sight, and when they are gone. */
  const freed: { disc: number; at: number }[] = [];
  const arrivals: { to: Place; view: TrackView; span: Span }[] = [];
  /** The disc that would come into each slot: one moving up or down the rack, or the one there. */
  const incoming: ({ disc: number; from: Place; span: Span } | null)[] = Array.from(
    { length: RACK_SLOTS },
    () => null,
  );
  let spindle = shelf.spindle;
  let outs = 0;
  let ins = 0;

  const leave = (disc: number, from: Place) => {
    const [start, end] =
      from === 'spindle' ? timing.spindleOut : nth(timing.slotOut, outs++, CASCADE_GAP_MS);
    moves.push({ disc, from, to: null, start, end });
    freed.push({ disc, at: end });
  };
  const travel = (disc: number, from: Place, to: Place, [start, end]: Span) => {
    if (from === to) {
      moves.push({ disc, from, to, start: 0, end: 0 });
      return;
    }
    moves.push({ disc, from, to, start, end });
    // Up into slot 0 or onto the spindle it prints again at 1024 px as it moves; down, at 512.
    const view = tracks[disc];
    if (view && sizeFor(to) !== sizeFor(from)) {
      prints.push({ disc, view, size: sizeFor(to), at: start });
    }
  };

  const landing =
    timeline === 'first' || timeline === 'next' || timeline === 'pick' ? change.slot : null;
  if (landing !== null) {
    // A rack disc lands: the ones in front of it (lower slots) leave, the ones behind it each
    // move as many slots nearer.
    if (shelf.spindle !== null) leave(shelf.spindle, 'spindle');
    const lander = shelf.rack[landing] as number;
    tracks[lander] = target.current;
    travel(lander, landing, 'spindle', timing.land);
    spindle = lander;
    for (let slot = 0; slot < landing; slot++) {
      const skipped = shelf.rack[slot];
      if (skipped !== null) leave(skipped, slot);
    }
    let order = 0;
    for (let slot = 0; slot + landing + 1 < RACK_SLOTS; slot++) {
      const from = slot + landing + 1;
      const disc = shelf.rack[from];
      if (disc !== null) {
        incoming[slot] = { disc, from, span: nth(timing.shift, order++, SHIFT_GAP_MS) };
      }
    }
  } else if (timeline === 'prev') {
    // The rack moves back a slot, the top disc first (slot 4's leaves), and the spindle's disc
    // goes back into slot 0.
    const top = shelf.rack[RACK_SLOTS - 1];
    if (top !== null) leave(top, RACK_SLOTS - 1);
    let order = 0;
    for (let slot = RACK_SLOTS - 1; slot >= 1; slot--) {
      const disc = shelf.rack[slot - 1];
      if (disc !== null) {
        incoming[slot] = { disc, from: slot - 1, span: nth(timing.shift, order++, SHIFT_GAP_MS) };
      }
    }
    incoming[0] = { disc: shelf.spindle as number, from: 'spindle', span: timing.back };
    spindle = null;
    if (target.current) arrivals.push({ to: 'spindle', view: target.current, span: timing.land });
  } else {
    // From the side, or a cascade: each slot keeps its disc if its track stays.
    const held = shelf.spindle === null ? null : tracks[shelf.spindle];
    if (shelf.spindle !== null && timeline === 'cascade' && sameTrack(held, target.current)) {
      tracks[shelf.spindle] = target.current;
      travel(shelf.spindle, 'spindle', 'spindle', timing.land);
    } else {
      if (shelf.spindle !== null) leave(shelf.spindle, 'spindle');
      spindle = null;
      if (target.current) arrivals.push({ to: 'spindle', view: target.current, span: timing.land });
    }
    for (let slot = 0; slot < RACK_SLOTS; slot++) {
      const disc = shelf.rack[slot];
      if (disc !== null) incoming[slot] = { disc, from: slot, span: [0, 0] };
    }
  }

  for (let slot = 0; slot < RACK_SLOTS; slot++) {
    const wanted = target.upcoming[slot] ?? null;
    const coming = incoming[slot];
    if (coming && wanted && sameTrack(tracks[coming.disc], wanted)) {
      tracks[coming.disc] = wanted;
      travel(coming.disc, coming.from, slot, coming.span);
      rack[slot] = coming.disc;
      continue;
    }
    if (coming) leave(coming.disc, coming.from);
    if (wanted) {
      arrivals.push({ to: slot, view: wanted, span: nth(timing.slotIn, ins++, CASCADE_GAP_MS) });
    }
  }

  // Arrivals take the spare copies first, then the ones this change sends away, soonest gone first.
  const shown = new Set<number>();
  if (shelf.spindle !== null) shown.add(shelf.spindle);
  for (const disc of shelf.rack) if (disc !== null) shown.add(disc);
  const spares: { disc: number; at: number }[] = [];
  for (let disc = 0; disc < DISC_COPIES; disc++) {
    if (!shown.has(disc)) spares.push({ disc, at: 0 });
  }
  const pool = [...spares, ...freed.sort((a, b) => a.at - b.at)];
  arrivals.sort((a, b) => a.span[0] - b.span[0]);
  for (const arrival of arrivals) {
    const copy = pool.shift();
    if (!copy) break;
    const ready = copy.at === 0 ? 0 : copy.at + PRINT_LEAD_MS;
    const delay = Math.max(0, ready - arrival.span[0]);
    moves.push({
      disc: copy.disc,
      from: null,
      to: arrival.to,
      start: arrival.span[0] + delay,
      end: arrival.span[1] + delay,
    });
    prints.push({ disc: copy.disc, view: arrival.view, size: sizeFor(arrival.to), at: copy.at });
    tracks[copy.disc] = arrival.view;
    if (arrival.to === 'spindle') spindle = copy.disc;
    else rack[arrival.to] = copy.disc;
  }

  const lands = spindle !== null && spindle !== shelf.spindle;
  const clears = shelf.spindle !== null && spindle !== shelf.spindle;
  const arm: ArmPlan | null =
    timeline !== 'cascade' || lands || clears
      ? {
          from: last.armAngle,
          spinFrom: last.spin,
          off: Math.abs(last.armAngle - ARM_REST) > ARM_EPSILON,
          at: 0,
          back: lands ? timing.armIn : null,
          liftFrom: last.armLift ?? 0,
        }
      : null;
  const flip =
    options?.booklet === false || sameTrack(shelf.booklet, target.booklet)
      ? null
      : { start: timing.flip, end: timing.flip + FLIP_MS, booklet: target.booklet };
  moves.sort((a, b) => a.start - b.start);
  const duration = Math.max(DURATION[timeline], flip?.end ?? 0, ...moves.map((move) => move.end));
  const after: Shelf = {
    spindle,
    rack,
    tracks,
    booklet: target.booklet,
    collection: target.collection,
  };
  const plan: Plan = { timeline, duration, moves, prints, flip, arm, door: null, after };
  return options?.door ? withDoor(plan) : plan;
}

/** The Clear model's door through a change: swinging open over `open`, shut over `shut` (ms in). */
export interface DoorPlan {
  open: Span;
  shut: Span;
}

/** How long the door takes to swing all the way open, and shut. */
export const DOOR_OPEN_MS = 250;
export const DOOR_SHUT_MS = 300;

const touchesSpindle = (move: DiscMove) => move.from === 'spindle' || move.to === 'spindle';

/** `plan`, every time in it `ms` later: the moves, the prints asked for in it, the case and the arm. */
function delayPlan(plan: Plan, ms: number): Plan {
  return {
    ...plan,
    duration: plan.duration + ms,
    moves: plan.moves.map((move) => ({ ...move, start: move.start + ms, end: move.end + ms })),
    prints: plan.prints.map((order) => (order.at > 0 ? { ...order, at: order.at + ms } : order)),
    flip: plan.flip && { ...plan.flip, start: plan.flip.start + ms, end: plan.flip.end + ms },
    arm: plan.arm && {
      ...plan.arm,
      at: plan.arm.at + ms,
      back: plan.arm.back && [plan.arm.back[0] + ms, plan.arm.back[1] + ms],
    },
  };
}

/**
 * The plan for a model with a door: the door all the way open before a disc leaves the spindle or
 * comes onto it, and shutting once the last of them is over. A plan whose first such move starts
 * sooner than the door can open waits for it, everything in it that much later.
 */
export function withDoor(plan: Plan): Plan {
  const first = Math.min(...plan.moves.filter(touchesSpindle).map((move) => move.start));
  if (!Number.isFinite(first)) return { ...plan, door: null };
  const waited = first < DOOR_OPEN_MS ? delayPlan(plan, DOOR_OPEN_MS - first) : plan;
  const spindle = waited.moves.filter(touchesSpindle);
  const openAt = Math.min(...spindle.map((move) => move.start)) - DOOR_OPEN_MS;
  const shutAt = Math.max(...spindle.map((move) => move.end));
  const door: DoorPlan = {
    open: [openAt, openAt + DOOR_OPEN_MS],
    shut: [shutAt, shutAt + DOOR_SHUT_MS],
  };
  return { ...waited, door, duration: Math.max(waited.duration, door.shut[1]) };
}

/** How far open the door is `tMs` into a change: 0 shut … 1 open, eased; 0 with no door. */
export function doorAt(door: DoorPlan | null, tMs: number): number {
  if (!door) return 0;
  return span(tMs, door.open[0], door.open[1]) - span(tMs, door.shut[0], door.shut[1]);
}

function armAt(arm: ArmPlan, t: number): ArmPose {
  const away = span(t, arm.at + ARM_AWAY[0], arm.at + ARM_AWAY[1]);
  const back = arm.back ? span(t, arm.back[0], arm.back[1]) : 0;
  return {
    armAngle: arm.from + (ARM_REST - arm.from) * away + (ARM_PLAY - ARM_REST) * back,
    armLift: Math.max(
      arm.liftFrom * (1 - away),
      arm.off ? bump(t, arm.at + ARM_LIFT_OFF[0], arm.at + ARM_LIFT_OFF[1]) : 0,
      arm.back ? bump(t, arm.back[0] - 50, arm.back[1] + 50) : 0,
    ),
    spin: arm.spinFrom * (1 - away) + (arm.back ? span(t, arm.back[1] - 150, arm.back[1] + 50) : 0),
  };
}

/** The pose `tMs` into `plan`; `rest` is the arm's resting pose, for a plan that holds it. */
export function posePlan(plan: Plan, tMs: number, rest: ArmPose): Pose {
  const t = Math.min(Math.max(tMs, 0), plan.duration);
  const moving: (DiscMove | null)[] = Array.from({ length: DISC_COPIES }, () => null);
  for (const move of plan.moves) {
    const held = moving[move.disc];
    // A copy's move is its latest that has started, or its first while none has.
    if (!held || (move.start <= t && move.start >= held.start)) moving[move.disc] = move;
  }
  const discs = moving.map((move): DiscPose | null => {
    if (!move) return null;
    const along = move.end > move.start ? span(t, move.start, move.end) : t >= move.start ? 1 : 0;
    if ((move.to === null && along >= 1) || (move.from === null && along <= 0)) return null;
    return { from: move.from, to: move.to, along };
  });
  let caseLift = 0;
  let caseTurn = 0;
  let bookletNew = false;
  if (plan.flip) {
    const { start, end } = plan.flip;
    const middle = (start + end) / 2;
    caseLift = span(t, start, start + FLIP_LIFT_MS) - span(t, end - FLIP_LIFT_MS, end);
    caseTurn = span(t, start + FLIP_LIFT_MS, middle) - span(t, middle, end - FLIP_LIFT_MS);
    bookletNew = t >= start + FLIP_EDGE_MS;
  }
  const arm = plan.arm ? armAt(plan.arm, t) : rest;
  return { ...arm, discs, caseLift, caseTurn, bookletNew, door: doorAt(plan.door, t) };
}

/** Between changes: the arm on the disc while a track is loaded, the disc spinning while it plays. */
export function restingArm(seated: boolean, loaded: boolean, playing: boolean): ArmPose {
  return {
    armAngle: seated && loaded ? ARM_PLAY : ARM_REST,
    armLift: 0,
    spin: seated && playing ? 1 : 0,
  };
}

/** How fast a turntable's resting arm, its lift and its platter ease toward the status's pose (1/s). */
export const TURNTABLE_EASE = 8;
/** An arm farther than this from its rest or its groove (the director's units) lifts to swing there. */
const REST_REACH = 0.01;

/** What a turntable's resting arm reads: the status, and the angles the rig has worked out. */
export interface TurntableRest {
  /** A record is on the platter. */
  seated: boolean;
  status: Status;
  positionMs: number;
  /** The director's angle for the position (ARM_PLAY at the lead-in, tonearm.ts directorAngle). */
  groove: number;
  /** A drag's angle (the director's units) while one goes on; null otherwise. */
  drag: number | null;
}

/**
 * Where a turntable's arm and platter go between changes. Playing: down on the groove, the platter
 * turning. Paused: lifted where it is, the platter still. Stopped (the sequencer's Stop is a pause
 * at 0:00, ruled 2026-11-13), idle, changing, or with nothing on the platter: at its rest, lifted
 * while `from` is not there yet. A drag holds the arm lifted at its angle. Any long way lifts it:
 * farther than REST_REACH from the groove (Play after Stop, a seek), it swings over the record
 * lifted and lowers once there; tracking, it stays down.
 */
export function turntableArm(rest: TurntableRest, from: Pick<ArmPose, 'armAngle'>): ArmPose {
  const playing = rest.status === 'playing';
  const paused = rest.status === 'paused' && rest.positionMs > 0;
  if (rest.drag !== null) return { armAngle: rest.drag, armLift: 1, spin: playing ? 1 : 0 };
  if (!rest.seated || (!playing && !paused)) {
    const away = Math.abs(from.armAngle - ARM_REST) > REST_REACH;
    return { armAngle: ARM_REST, armLift: away ? 1 : 0, spin: 0 };
  }
  const far = Math.abs(from.armAngle - rest.groove) > REST_REACH;
  return { armAngle: rest.groove, armLift: playing && !far ? 0 : 1, spin: playing ? 1 : 0 };
}

/**
 * `from` eased toward `to` over `dtS` seconds at TURNTABLE_EASE (Infinity: at once, under reduced
 * motion), each part landing once within a hair; `snapAngle` takes the angle at once (a drag's).
 */
export function easeArm(from: ArmPose, to: ArmPose, dtS: number, snapAngle = false): ArmPose {
  const k = dtS === Infinity ? 1 : 1 - Math.exp(-TURNTABLE_EASE * Math.max(0, dtS));
  const step = (a: number, b: number) => (Math.abs(b - a) < 1e-4 ? b : a + (b - a) * k);
  return {
    armAngle: snapAngle ? to.armAngle : step(from.armAngle, to.armAngle),
    armLift: step(from.armLift, to.armLift),
    spin: step(from.spin, to.spin),
  };
}

/**
 * Between changes: every copy where the shelf puts it, the case in its seat, the arm as `arm` has
 * it (a turntable's, eased toward its status; a CD player's, restingArm's).
 */
export function restingPose(
  shelf: Shelf,
  loaded: boolean,
  playing: boolean,
  arm: ArmPose = restingArm(shelf.spindle !== null, loaded, playing),
): Pose {
  const discs: (DiscPose | null)[] = Array.from({ length: DISC_COPIES }, () => null);
  if (shelf.spindle !== null) discs[shelf.spindle] = { from: 'spindle', to: 'spindle', along: 1 };
  shelf.rack.forEach((disc, slot) => {
    if (disc !== null) discs[disc] = { from: slot, to: slot, along: 1 };
  });
  return {
    ...arm,
    discs,
    caseLift: 0,
    caseTurn: 0,
    bookletNew: false,
    door: 0,
  };
}
