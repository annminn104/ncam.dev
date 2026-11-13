import { describe, expect, it } from 'vitest';
import { MODELS } from '../models';
import { SCENE_PROFILES } from './profiles';

describe('scene profiles', () => {
  it('plays CDs on the suitcase, the Clear model and the Deck', () => {
    for (const id of ['suitcase', 'clear', 'deck'] as const) {
      expect(SCENE_PROFILES[id].media, id).toBe('cd');
    }
  });

  it('gives every model a profile', () => {
    for (const model of MODELS) expect(SCENE_PROFILES[model.id], model.id).toBeDefined();
  });

  it('keeps the suitcase as it was framed and driven', () => {
    const { frame, arm, door, flight } = SCENE_PROFILES.suitcase;
    expect(frame.target).toEqual([0, 0.132, 0.01]);
    const n = Math.hypot(-0.48, 0.338, 0.79);
    frame.direction.forEach((c, i) => expect(c).toBeCloseTo([-0.48, 0.338, 0.79][i] / n, 12));
    expect(frame.across).toBe(0.285);
    expect(frame.up).toBe(0.285);
    expect(arm).toEqual({ rest: 0, play: -0.52 });
    expect(door).toBeNull();
    // Its discs reach 8 cm out of the lid and the deck, and leave up and to the left.
    expect(flight).toEqual({ reach: { slot: 0.08, spindle: 0.08 }, aside: [-0.16, 0.06, 0] });
  });

  it('flies the Clear model’s discs well out of its stand, and away out of its door to the right', () => {
    const { flight } = SCENE_PROFILES.clear;
    expect(flight.reach.slot).toBeGreaterThan(flight.reach.spindle);
    const [x, y, z] = flight.aside;
    // In front of the door, away from its hinge on the left, and up.
    expect(z).toBeGreaterThan(0);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });

  it('gives the Clear model a door, and a unit direction', () => {
    const { frame, door } = SCENE_PROFILES.clear;
    expect(door).not.toBeNull();
    expect(Math.hypot(...frame.direction)).toBeCloseTo(1, 12);
  });

  it('swings the Clear arm over the disc at +0.52 and its door out toward the viewer', () => {
    const { arm, door } = SCENE_PROFILES.clear;
    expect(arm).toEqual({ rest: 0, play: 0.52 });
    expect(door?.angle).toBeCloseTo(-(100 * Math.PI) / 180, 12);
  });

  it('drives the Deck’s jog plate about X, its disc clockwise by the knob, with its big screen', () => {
    const { arm, door, knobTurnsDisc, clockwise, screen, frame } = SCENE_PROFILES.deck;
    expect(knobTurnsDisc).toBe(true);
    expect(clockwise).toBe(true);
    expect(screen).toBe('deck');
    expect(door?.axis).toBe('x');
    // The plate lifts front up: a negative turn about X, to upright (the measures test lifts it so).
    expect(door?.angle).toBeCloseTo(-(90 * Math.PI) / 180, 12);
    // The arm plays 50° about its pivot's Y (deck.py's DECK_ARM_PLAY).
    expect(arm).toEqual({ rest: 0, play: (50 * Math.PI) / 180 });
    expect(Math.hypot(...frame.direction)).toBeCloseTo(1, 12);
  });

  it('gives the suitcase and the Clear model the segment LCD, and neither a knob that turns the disc', () => {
    for (const id of ['suitcase', 'clear'] as const) {
      expect(SCENE_PROFILES[id].screen, id).toBeUndefined();
      expect(SCENE_PROFILES[id].knobTurnsDisc, id).toBeUndefined();
      expect(SCENE_PROFILES[id].clockwise, id).toBeUndefined();
    }
  });
});
