import { describe, expect, it } from 'vitest';
import type { TrackView } from '../bridge';
import {
  ARM_PLAY,
  ARM_REST,
  DOOR_OPEN_MS,
  DURATION,
  FLIP_EDGE_MS,
  FLIP_MS,
  PRINT_LEAD_MS,
  doorAt,
  planChange,
  posePlan,
  restingArm,
  restingPose,
  withDoor,
  type Plan,
} from './director';
import {
  DISC_COPIES,
  classifyChange,
  emptyShelf,
  fillShelf,
  lineupOf,
  targetOf,
  type Lineup,
  type Place,
  type Shelf,
} from './stage';

const track = (id: string): TrackView => ({
  id,
  title: id,
  artists: 'A',
  artUrl: null,
  artistUrl: null,
});
const MIX = { name: 'Mix', subtitle: 'Owner', key: 'playlist:mix' };
const lineup = (current: string | null, ...upcoming: string[]): Lineup => ({
  collection: MIX,
  current: current === null ? null : track(current),
  upcoming: upcoming.map(track),
});
const PLAYING = { armAngle: ARM_PLAY, spin: 1 };
const RESTING = { armAngle: ARM_REST, spin: 0 };
/** The resting arm of a track that plays (what holds while a cascade leaves the arm alone). */
const REST = restingArm(true, true, true);

/** The plan the swap controller makes from a shelf that holds `before`, for the view `after`. */
function plan(before: Lineup, after: Lineup, to: string | null, last = PLAYING): Plan {
  const shelf = fillShelf(targetOf(before));
  const arriving = to === null ? null : track(to);
  const change = classifyChange(lineupOf(shelf), after, arriving);
  return planChange(change, shelf, targetOf(after, arriving), last);
}

const name = (place: Place | null) => (place === null ? '·' : String(place));

/** Where each copy is `t` ms in: its place, `a→b` on its way (· out of sight), null if unseen. */
function where(p: Plan, t: number): (string | null)[] {
  return posePlan(p, t, REST).discs.map((disc) => {
    if (!disc) return null;
    if (disc.from === disc.to || disc.along <= 0) return name(disc.from);
    if (disc.along >= 1) return name(disc.to);
    return `${name(disc.from)}→${name(disc.to)}`;
  });
}

/** Where each copy rests on `shelf`. */
const restsOn = (shelf: Shelf) =>
  restingPose(shelf, true, true).discs.map((disc) => (disc ? name(disc.to) : null));

const prints = (p: Plan) => p.prints.map(({ disc, view, size, at }) => [disc, view.id, size, at]);

/** A copy that arrives was out of sight PRINT_LEAD_MS before, and its print was asked for by then. */
function expectReusesOutOfSight(p: Plan): void {
  for (const arrival of p.moves.filter((move) => move.from === null)) {
    for (const earlier of p.moves.filter((m) => m.disc === arrival.disc && m !== arrival)) {
      expect(earlier.to, `copy ${arrival.disc}`).toBeNull();
      expect(earlier.end, `copy ${arrival.disc}`).toBeLessThanOrEqual(
        arrival.start - PRINT_LEAD_MS,
      );
    }
    const id = p.after.tracks[arrival.disc]?.id;
    const order = p.prints.find((print) => print.disc === arrival.disc && print.view.id === id);
    expect(order, `copy ${arrival.disc}`).toBeDefined();
    expect(order!.at === 0 || order!.at <= arrival.start - PRINT_LEAD_MS).toBe(true);
  }
}

/**
 * Where copy `disc` is at `t`, counted in slots: a whole slot at rest there (or growing or
 * shrinking in it), a fraction on its straight way between two slots (the rig smoothsteps it);
 * null on the spindle, on its way to or from it, or out of sight.
 */
function slotOf(p: Plan, disc: number, t: number): number | null {
  const pose = posePlan(p, t, REST).discs[disc];
  if (!pose || pose.from === 'spindle' || pose.to === 'spindle') return null;
  const from = pose.from ?? pose.to;
  const to = pose.to ?? pose.from;
  if (typeof from !== 'number' || typeof to !== 'number') return null;
  const w = pose.along * pose.along * (3 - 2 * pose.along);
  return from + (to - from) * w;
}

/**
 * Each slot stands behind the one below it (slot 0 the frontmost), so: a disc takes off towards
 * the spindle only with nothing in a lower slot; a disc comes into a slot (growing, or back from
 * the spindle) only once the slot's last disc has moved a slot away; and no disc flies to or from
 * the spindle while the case turns.
 */
function expectClear(p: Plan): void {
  const others = (disc: number) =>
    Array.from({ length: DISC_COPIES }, (_, other) => other).filter((other) => other !== disc);
  for (const move of p.moves) {
    if (typeof move.from === 'number' && move.to === 'spindle') {
      for (const other of others(move.disc)) {
        const slot = slotOf(p, other, move.start);
        expect(slot === null || slot > (move.from as number), `copy ${other} in front`).toBe(true);
      }
    }
    if ((move.from === null || move.from === 'spindle') && typeof move.to === 'number') {
      for (const other of others(move.disc)) {
        const slot = slotOf(p, other, move.start);
        const away = slot === null || Math.abs(slot - (move.to as number)) >= 0.9;
        expect(away, `copy ${other} in slot ${move.to}`).toBe(true);
      }
    }
    const flies = (move.from === 'spindle' || move.to === 'spindle') && move.from !== move.to;
    if (p.flip && flies) {
      const apart = move.end <= p.flip.start || move.start >= p.flip.end;
      expect(apart, `copy ${move.disc} flies while the case turns`).toBe(true);
    }
  }
}

const FIRST = plan(
  lineup(null, 'a', 'b', 'c', 'd', 'e'),
  lineup('a', 'b', 'c', 'd', 'e', 'f'),
  'a',
  RESTING,
);
const NEXT = plan(lineup('a', 'b', 'c', 'd', 'e', 'f'), lineup('b', 'c', 'd', 'e', 'f', 'g'), 'b');
const PREV = plan(lineup('b', 'c', 'd', 'e', 'f', 'g'), lineup('a', 'b', 'c', 'd', 'e', 'f'), 'a');
const PICK = plan(lineup('a', 'b', 'c', 'd', 'e', 'f'), lineup('d', 'e', 'f', 'g', 'h', 'i'), 'd');
const PICK_1 = plan(
  lineup('a', 'b', 'c', 'd', 'e', 'f'),
  lineup('c', 'd', 'e', 'f', 'g', 'h'),
  'c',
);
const PICK_4 = plan(
  lineup('a', 'b', 'c', 'd', 'e', 'f'),
  lineup('f', 'g', 'h', 'i', 'j', 'k'),
  'f',
);
const SIDE = plan(lineup('a', 'b', 'c', 'd', 'e', 'f'), lineup('x', 'y', 'z', 'd', 'e', 'f'), 'x');
const OTHER: Lineup = {
  ...lineup(null, 'p', 'q', 'r', 's', 't'),
  collection: { name: 'Other', subtitle: 'Someone', key: 'playlist:other' },
};
const COLLECTION = plan(lineup('a', 'b', 'c', 'd', 'e', 'f'), OTHER, null);
const RESTACK = plan(
  lineup('a', 'b', 'c', 'd', 'e', 'f'),
  lineup('a', 'f', 'c', 'e', 'b', 'd'),
  null,
);

describe('planChange: first play', () => {
  it('lands slot 0’s disc, moves each disc behind it a slot nearer and grows a new one into slot 4', () => {
    expect(FIRST.timeline).toBe('first');
    expect(FIRST.duration).toBe(1600);
    expect(where(FIRST, 0)).toEqual(['0', '1', '2', '3', '4', null, null]);
    expect(where(FIRST, 800)).toEqual(['spindle', '0', '2→1', '3→2', '4→3', null, null]);
    expect(where(FIRST, 1350)).toEqual(['spindle', '0', '1', '2', '3', '4', null]);
    expect(where(FIRST, FIRST.duration)).toEqual(restsOn(FIRST.after));
  });

  it('swings the arm in from its rest and lowers it as the music starts', () => {
    expect(posePlan(FIRST, 0, REST)).toMatchObject({ armAngle: ARM_REST, armLift: 0, spin: 0 });
    const end = posePlan(FIRST, FIRST.duration, REST);
    expect(end.armAngle).toBeCloseTo(ARM_PLAY);
    expect(end.armLift).toBeCloseTo(0);
    expect(end.spin).toBeCloseTo(1);
  });

  it('prints the new disc on a spare copy first, the one moving into slot 0 at 1024 px as it moves', () => {
    expect(prints(FIRST)).toEqual([
      [1, 'b', 1024, 450],
      [5, 'f', 512, 0],
    ]);
    // The booklet already shows the first track: it stays.
    expect(FIRST.flip).toBeNull();
  });
});

describe('planChange: next (and a natural end)', () => {
  it('sends the spindle’s disc away, lands slot 0’s, advances the rack and refills slot 4', () => {
    expect(NEXT.timeline).toBe('next');
    expect(NEXT.duration).toBe(DURATION.next);
    expect(where(NEXT, 0)).toEqual(['spindle', '0', '1', '2', '3', '4', null]);
    expect(where(NEXT, 1050)).toEqual([null, '0→spindle', '1', '2', '3', '4', null]);
    expect(where(NEXT, 1600)).toEqual([null, 'spindle', '0', '2→1', '3→2', '4→3', null]);
    expect(where(NEXT, 2200)).toEqual([null, 'spindle', '0', '1', '2', '3', '4']);
    expect(where(NEXT, NEXT.duration)).toEqual(restsOn(NEXT.after));
  });

  it('lifts the arm off to its rest first and lowers it onto the new disc last', () => {
    expect(posePlan(NEXT, 0, REST)).toMatchObject({ armAngle: ARM_PLAY, spin: 1 });
    expect(posePlan(NEXT, 250, REST).armLift).toBeCloseTo(1);
    expect(posePlan(NEXT, 400, REST).armAngle).toBeCloseTo(ARM_REST);
    expect(posePlan(NEXT, 400, REST).spin).toBeCloseTo(0);
    const end = posePlan(NEXT, DURATION.next, REST);
    expect(end.armAngle).toBeCloseTo(ARM_PLAY);
    expect(end.armLift).toBeCloseTo(0);
    expect(end.spin).toBeCloseTo(1);
  });

  it('turns the case over and back once the disc has landed, the booklet changing edge-on', () => {
    expect(NEXT.flip).toEqual({
      start: 1600,
      end: 1600 + FLIP_MS,
      booklet: expect.objectContaining({ id: 'b' }),
    });
    const at = (t: number) => posePlan(NEXT, t, REST);
    expect(at(1600)).toMatchObject({ caseLift: 0, caseTurn: 0, bookletNew: false });
    expect(at(1800).caseLift).toBeCloseTo(1);
    expect(at(1600 + FLIP_EDGE_MS - 1).bookletNew).toBe(false);
    expect(at(1600 + FLIP_EDGE_MS).bookletNew).toBe(true);
    expect(at(1600 + FLIP_EDGE_MS).caseTurn).toBeCloseTo(0.5);
    expect(at(2050).caseTurn).toBeCloseTo(1);
    expect(at(2500)).toMatchObject({ caseLift: 0, caseTurn: 0, bookletNew: true });
  });

  it('prints the new disc on the spare copy first, the one moving into slot 0 at 1024 px as it moves', () => {
    expect(prints(NEXT)).toEqual([
      [2, 'c', 1024, 1250],
      [6, 'g', 512, 0],
    ]);
  });
});

describe('planChange: prev', () => {
  it('moves the rack back a slot, puts the spindle’s disc back in slot 0, brings the previous in from the side', () => {
    expect(PREV.timeline).toBe('prev');
    expect(where(PREV, 0)).toEqual(['spindle', '0', '1', '2', '3', '4', null]);
    expect(where(PREV, 1180)).toEqual(['spindle', '1', '2', '3', '4', null, null]);
    expect(where(PREV, 1900)).toEqual(['0', '1', '2', '3', '4', null, '·→spindle']);
    expect(where(PREV, 2350)).toEqual(['0', '1', '2', '3', '4', null, 'spindle']);
    expect(where(PREV, PREV.duration)).toEqual(restsOn(PREV.after));
  });

  it('prints the previous track on the spare copy, the disc going back to slot 1 at 512 px', () => {
    expect(prints(PREV)).toEqual([
      [1, 'c', 512, 880],
      [6, 'a', 1024, 0],
    ]);
    // The case turns first, while no disc flies.
    expect(PREV.flip).toEqual({
      start: 300,
      end: 1200,
      booklet: expect.objectContaining({ id: 'a' }),
    });
  });
});

describe('planChange: a row in the rack', () => {
  it('flies the picked disc down once those in front have gone, the rest close up, new ones grow in', () => {
    expect(PICK.timeline).toBe('pick');
    expect(where(PICK, 0)).toEqual(['spindle', '0', '1', '2', '3', '4', null]);
    expect(where(PICK, 1120)).toEqual([null, null, null, '2→spindle', '3', '4', null]);
    expect(where(PICK, 2230)).toEqual([null, '3', '4', 'spindle', '0', '1', '2']);
    expect(where(PICK, PICK.duration)).toEqual(restsOn(PICK.after));
  });

  it('prints the new discs on copies out of sight by then, and the discs landing at 1024 px', () => {
    expect(prints(PICK)).toEqual([
      [3, 'd', 1024, 900],
      [4, 'e', 1024, 1250],
      [6, 'g', 512, 0],
      [1, 'h', 512, 600],
      [2, 'i', 512, 690],
    ]);
  });
});

describe('planChange: any other row', () => {
  it('brings the track in from the side and reprints the slots that change, in a cascade', () => {
    expect(SIDE.timeline).toBe('side');
    expect(where(SIDE, 0)).toEqual(['spindle', '0', '1', '2', '3', '4', null]);
    expect(where(SIDE, 1100)).toEqual([null, null, null, '2', '3', '4', null]);
    expect(where(SIDE, 1850)).toEqual([null, '0', '·→1', '2', '3', '4', 'spindle']);
    expect(where(SIDE, SIDE.duration)).toEqual(restsOn(SIDE.after));
    expect(prints(SIDE)).toEqual([
      [6, 'x', 1024, 0],
      [1, 'y', 1024, 800],
      [2, 'z', 512, 890],
    ]);
  });
});

describe('planChange: a cascade', () => {
  it('empties the rack and fills it with a new collection, the spindle’s disc leaving', () => {
    expect(COLLECTION.timeline).toBe('cascade');
    // 1.6 s, and the case's turn after the spindle's disc has gone.
    expect(COLLECTION.duration).toBe(1950);
    expect(where(COLLECTION, 0)).toEqual(['spindle', '0', '1', '2', '3', '4', null]);
    expect(where(COLLECTION, 710)).toEqual(['spindle→·', null, null, null, null, null, null]);
    expect(where(COLLECTION, 1510)).toEqual([null, '1', '2', '3', '4', null, '0']);
    expect(where(COLLECTION, COLLECTION.duration)).toEqual(restsOn(COLLECTION.after));
    expect(COLLECTION.after.collection).toEqual(OTHER.collection);
    expect(COLLECTION.flip).toEqual({
      start: 1050,
      end: 1950,
      booklet: expect.objectContaining({ id: 'p' }),
    });
    // The arm lifts off and stays at its rest: nothing lands.
    expect(posePlan(COLLECTION, 0, REST).armAngle).toBe(ARM_PLAY);
    expect(posePlan(COLLECTION, COLLECTION.duration, REST)).toMatchObject({
      armAngle: ARM_REST,
      spin: 0,
    });
  });

  it('reprints only the slots that change for Shuffle, never lifting the arm off a playing disc', () => {
    expect(RESTACK.timeline).toBe('cascade');
    expect(RESTACK.arm).toBeNull();
    expect(RESTACK.flip).toBeNull();
    expect(where(RESTACK, 0)).toEqual(['spindle', '0', '1', '2', '3', '4', null]);
    expect(where(RESTACK, 1420)).toEqual(['spindle', '2', '1', '3', '4', null, '0']);
    expect(posePlan(RESTACK, 500, REST)).toMatchObject({ armAngle: ARM_PLAY, armLift: 0, spin: 1 });
  });
});

describe('planChange: every timeline', () => {
  const all = { FIRST, NEXT, PREV, PICK, PICK_1, PICK_4, SIDE, COLLECTION, RESTACK };

  it.each(Object.entries(all))(
    '%s reuses only copies out of sight, their prints on in time',
    (_, p) => {
      expectReusesOutOfSight(p);
    },
  );

  it.each(Object.entries(all))(
    '%s keeps its discs clear of each other and of the turning case',
    (_, p) => {
      expectClear(p);
    },
  );

  it.each(Object.entries(all))('%s takes at most 2.8 s', (_, p) => {
    expect(p.duration).toBeLessThanOrEqual(2800);
  });

  it('clamps outside its time', () => {
    expect(posePlan(NEXT, -10, REST)).toEqual(posePlan(NEXT, 0, REST));
    expect(posePlan(NEXT, 99_999, REST)).toEqual(posePlan(NEXT, NEXT.duration, REST));
  });
});

describe('restingPose', () => {
  it('rests every copy where the shelf puts it, the arm on a loaded disc, spinning while it plays', () => {
    const shelf = fillShelf(targetOf(lineup('a', 'b', 'c', 'd', 'e', 'f')));
    expect(restsOn(shelf)).toEqual(['spindle', '0', '1', '2', '3', '4', null]);
    expect(restingPose(shelf, true, true)).toMatchObject({
      armAngle: ARM_PLAY,
      spin: 1,
      caseLift: 0,
      caseTurn: 0,
      bookletNew: false,
    });
    expect(restingPose(shelf, true, false)).toMatchObject({ armAngle: ARM_PLAY, spin: 0 });
    expect(restingPose(shelf, false, false)).toMatchObject({ armAngle: ARM_REST, spin: 0 });
    const waiting = fillShelf(targetOf(lineup(null, 'a', 'b')));
    expect(restsOn(waiting)).toEqual(['0', '1', null, null, null, null, null]);
    expect(restingPose(waiting, true, true).armAngle).toBe(ARM_REST);
    expect(restsOn(emptyShelf())).toEqual([null, null, null, null, null, null, null]);
  });
});

describe('the door (a model that has one)', () => {
  const PLANS = { FIRST, NEXT, PREV, PICK, PICK_1, PICK_4, SIDE, COLLECTION, RESTACK };
  const touches = (m: Plan['moves'][number]) => m.from === 'spindle' || m.to === 'spindle';

  it('is all the way open while a disc leaves the spindle or comes onto it', () => {
    for (const [label, base] of Object.entries(PLANS)) {
      const p = withDoor(base);
      for (const move of p.moves.filter(touches)) {
        for (let t = move.start; t <= move.end; t += 10) {
          expect(doorAt(p.door, t), `${label} ${t}`).toBeGreaterThanOrEqual(0.999);
        }
      }
    }
  });

  it('is shut at the change’s start and end, and stays shut with nothing at the spindle', () => {
    for (const [label, base] of Object.entries(PLANS)) {
      const p = withDoor(base);
      expect(doorAt(p.door, 0), label).toBe(0);
      expect(doorAt(p.door, p.duration), label).toBe(0);
      if (!base.moves.some(touches)) expect(p.door, label).toBeNull();
    }
  });

  it('makes a change whose first spindle move comes too soon wait for the door', () => {
    const p = withDoor(FIRST);
    const first = Math.min(...p.moves.filter(touches).map((m) => m.start));
    expect(first).toBe(DOOR_OPEN_MS);
    expect(p.duration).toBe(
      FIRST.duration +
        (DOOR_OPEN_MS - Math.min(...FIRST.moves.filter(touches).map((m) => m.start))),
    );
    expect(p.arm?.at).toBe(
      DOOR_OPEN_MS - Math.min(...FIRST.moves.filter(touches).map((m) => m.start)),
    );
  });

  it('changes nothing for a model without a door', () => {
    expect(NEXT.door).toBeNull();
    expect(posePlan(NEXT, 1000, REST).door).toBe(0);
    expect(restingPose(fillShelf(targetOf(lineup('a', 'b'))), true, true).door).toBe(0);
  });
});

describe('a model without a jewel case', () => {
  it('turns no booklet, every disc move and the arm as a cased model\u2019s', () => {
    const shelf = fillShelf(targetOf(lineup('a', 'b', 'c', 'd', 'e', 'f')));
    const after = lineup('b', 'c', 'd', 'e', 'f', 'g');
    const change = classifyChange(lineupOf(shelf), after, track('b'));
    const target = targetOf(after, track('b'));
    const caseless = planChange(change, shelf, target, PLAYING, { booklet: false });
    const cased = planChange(change, shelf, target, PLAYING);
    expect(caseless.flip).toBeNull();
    expect(cased.flip).not.toBeNull();
    expect(caseless.moves).toEqual(cased.moves);
    expect(caseless.arm).toEqual(cased.arm);
    expect(caseless.duration).toBe(DURATION.next);
    // The shelf still notes the booklet's track, as the swap controller compares it.
    expect(caseless.after.booklet?.id).toBe('b');
  });

  it('ends a cascade when its discs are done, not when a booklet would have turned', () => {
    const shelf = fillShelf(targetOf(lineup(null, 'a', 'b', 'c', 'd', 'e')));
    const after = lineup(null, 'v', 'w', 'x', 'y', 'z');
    const change = classifyChange(lineupOf(shelf), after, null);
    const cased = planChange(change, shelf, targetOf(after), RESTING);
    const caseless = planChange(change, shelf, targetOf(after), RESTING, { booklet: false });
    expect(cased.timeline).toBe('cascade');
    expect(cased.duration).toBe(1050 + FLIP_MS);
    expect(caseless.duration).toBe(DURATION.cascade);
  });
});
