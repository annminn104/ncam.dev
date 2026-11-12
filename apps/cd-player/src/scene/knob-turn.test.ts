import { describe, expect, it } from 'vitest';
import { foldTurn, knobSeekMs } from './controls';
import { knobTurns, type KnobRig } from './knob-turn';

const QUARTER = Math.PI / 2;

/** A knob at the origin: a pointer's angle around it is its own angle from the x axis. */
function setup({ follows = true, spin = 1 }: { follows?: boolean; spin?: number } = {}) {
  const rig: KnobRig = { spin, knobTurn: 0, scrubMs: null, doorOpen: 0, swapping: false };
  const knob = { rotation: { y: 0.25 } };
  const seeks: number[] = [];
  const turns = knobTurns(
    rig,
    knob,
    follows,
    (x, y) => Math.atan2(y, x),
    (deltaMs) => seeks.push(deltaMs),
  );
  return { rig, knob, seeks, turns };
}

describe('knobTurns', () => {
  it('scrubs while it turns and seeks by the whole turn on the release', () => {
    const { rig, knob, seeks, turns } = setup();
    turns.down(1, 1, 0, 0);
    turns.move(1, 0, 1, 0, false);
    expect(knob.rotation.y).toBeCloseTo(0.25 - QUARTER, 12);
    expect(rig.scrubMs).toBe(knobSeekMs(QUARTER));
    expect(rig.knobTurn).toBeCloseTo(-QUARTER, 12);
    turns.up(1, 0);
    expect(seeks).toEqual([knobSeekMs(QUARTER)]);
    expect(rig.scrubMs).toBeNull();
    expect(rig.knobTurn).toBe(0);
    // The disc keeps the turn it followed.
    expect(rig.spin).toBeCloseTo(foldTurn(1, -QUARTER), 12);
  });

  it('turns the disc only for a profile whose knob turns it', () => {
    const { rig, seeks, turns } = setup({ follows: false });
    turns.down(1, 1, 0, 0);
    turns.move(1, 0, 1, 0, false);
    expect(rig.knobTurn).toBe(0);
    turns.up(1, 0);
    expect(seeks).toEqual([knobSeekMs(QUARTER)]);
    expect(rig.spin).toBe(1);
  });

  it('follows only the pointer that went down on the knob', () => {
    const { rig, seeks, turns } = setup();
    turns.down(1, 1, 0, 0);
    turns.move(2, 0, 1, 0, false);
    turns.up(2, 0);
    expect(rig.scrubMs).toBeNull();
    expect(seeks).toEqual([]);
    turns.up(1, 0);
    expect(seeks).toEqual([]);
  });

  it('takes no turn while the door is open', () => {
    const { rig, knob, seeks, turns } = setup();
    rig.doorOpen = 0.4;
    turns.down(1, 1, 0, 0);
    turns.move(1, 0, 1, 0, false);
    turns.up(1, 0);
    expect(knob.rotation.y).toBe(0.25);
    expect(seeks).toEqual([]);
  });

  it('takes no turn while a change runs, before the door has moved', () => {
    const { rig, seeks, turns } = setup();
    rig.swapping = true;
    turns.down(1, 1, 0, 0);
    turns.move(1, 0, 1, 0, false);
    turns.up(1, 0);
    expect(rig.scrubMs).toBeNull();
    expect(seeks).toEqual([]);
  });

  // A track that ends mid-turn swaps the disc the turn was scrubbing: the turn ends where it
  // stands, so the leaving disc goes with the turn it had followed and no more, the displays stop
  // previewing a seek, and the release seeks nothing in the track that arrives.
  it.each([
    ['a change begins', (rig: KnobRig) => (rig.swapping = true)],
    ['the door opens', (rig: KnobRig) => (rig.doorOpen = 0.05)],
  ])('ends a turn where it stands as soon as %s', (_, change) => {
    const { rig, knob, seeks, turns } = setup();
    turns.down(1, 1, 0, 0);
    turns.move(1, 0, 1, 0, false);
    const disc = rig.spin + rig.knobTurn;
    change(rig);
    turns.frame();
    expect(rig.scrubMs).toBeNull();
    expect(rig.knobTurn).toBe(0);
    expect(rig.spin).toBeCloseTo(foldTurn(disc, 0), 12);
    expect(knob.rotation.y).toBeCloseTo(0.25 - QUARTER, 12);
    turns.move(1, -1, 0, 0, false);
    expect(rig.knobTurn).toBe(0);
    expect(rig.scrubMs).toBeNull();
    expect(knob.rotation.y).toBeCloseTo(0.25 - QUARTER, 12);
    turns.up(1, 0);
    expect(seeks).toEqual([]);
  });

  it.each([
    ['moves', (t: ReturnType<typeof setup>['turns']) => t.move(1, -1, 0, 0, false)],
    ['lifts', (t: ReturnType<typeof setup>['turns']) => t.up(1, 0)],
  ])('ends a turn a change began under before the next frame, when the pointer %s', (_, next) => {
    const { rig, seeks, turns } = setup();
    turns.down(1, 1, 0, 0);
    turns.move(1, 0, 1, 0, false);
    rig.swapping = true;
    next(turns);
    turns.up(1, 0);
    expect(rig.knobTurn).toBe(0);
    expect(rig.scrubMs).toBeNull();
    expect(seeks).toEqual([]);
  });

  it.each([
    ['cancelled', (t: ReturnType<typeof setup>['turns']) => t.cancel(1)],
    ['with its release lost', (t: ReturnType<typeof setup>['turns']) => t.move(1, -1, 0, 0, true)],
    ['become a pinch', (t: ReturnType<typeof setup>['turns']) => t.up(1, 1)],
  ])('gives the knob and the disc back, seeking nothing, %s', (_, end) => {
    const { rig, knob, seeks, turns } = setup();
    turns.down(1, 1, 0, 0);
    turns.move(1, 0, 1, 0, false);
    end(turns);
    turns.up(1, 0);
    expect(knob.rotation.y).toBe(0.25);
    expect(rig.knobTurn).toBe(0);
    expect(rig.scrubMs).toBeNull();
    expect(rig.spin).toBe(1);
    expect(seeks).toEqual([]);
  });
});
