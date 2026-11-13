import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  BUTTON_ACTIONS,
  BUTTON_NODES,
  hitFor,
  foldTurn,
  knobSeekMs,
  knobTakesTurn,
  PRESS_MS,
  pinchedSince,
  pressDepth,
  pressesOnDown,
  scrubTargetMs,
  stillTap,
  type KeyTouch,
} from './controls';
import { REQUIRED_NODES } from './contract';
import { TAP_SLOP_PX } from './orbit';

type Node = { name: string; parent: Node | null };
const chain = (...names: string[]): Node => {
  let node: Node | null = null;
  for (const name of names) node = { name, parent: node };
  return node!;
};

describe('controls', () => {
  it('finds the key, the knob or the tonearm head above a hit mesh', () => {
    expect(hitFor(chain('player', 'btn_play', 'player_btn_cap_play'))).toEqual({
      kind: 'button',
      node: 'btn_play',
      action: { type: 'toggle' },
    });
    expect(hitFor(chain('player', 'knob', 'player_knob_body'))).toEqual({ kind: 'knob' });
    expect(hitFor(chain('player', 'player_frame'))).toBeNull();
    expect(hitFor(null)).toBeNull();
    expect(hitFor(chain('luxe', 'arm_pivot', 'arm_head', 'luxe_arm_hit'))).toEqual({ kind: 'arm' });
    expect(hitFor(chain('luxe', 'arm_pivot', 'luxe_arm_tube'))).toBeNull();
  });

  it('turns the knob into seconds: a full turn is 30 s', () => {
    expect(knobSeekMs(2 * Math.PI)).toBe(30_000);
    expect(knobSeekMs(-Math.PI / 2)).toBe(-7_500);
  });

  it('presses a key down and back within 160 ms', () => {
    expect(pressDepth(0)).toBe(0);
    expect(pressDepth(80)).toBeCloseTo(0.0012);
    expect(pressDepth(200)).toBe(0);
  });

  it('measures the shortest turn between two angles', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(angleDelta(0, 0.5)).toBeCloseTo(0.5);
  });

  it('keys the deck by the btn_ nodes of the model contract, and by nothing else', () => {
    const contract = REQUIRED_NODES.filter((name) => name.startsWith('btn_')).sort();
    expect([...BUTTON_NODES].sort()).toEqual(contract);
    expect(Object.keys(BUTTON_ACTIONS).sort()).toEqual(contract);
    // A node that is only named like something every object has is not a key.
    expect(hitFor(chain('player', 'toString'))).toBeNull();
    expect(hitFor(chain('constructor', 'hasOwnProperty'))).toBeNull();
  });

  it('presses over PRESS_MS: down to the deepest at the middle, back at the end', () => {
    expect(pressDepth(PRESS_MS / 2)).toBeCloseTo(0.0012);
    expect(pressDepth(PRESS_MS * 0.9)).toBeGreaterThan(0);
    expect(pressDepth(PRESS_MS)).toBe(0);
  });
});

describe('a touch on a key', () => {
  // A pinch's first finger may land on a key: a touch presses as it lifts, if it stayed a tap.
  it('presses as it goes down for a mouse or a pen, as it lifts for a touch', () => {
    expect(pressesOnDown('mouse')).toBe(true);
    expect(pressesOnDown('pen')).toBe(true);
    expect(pressesOnDown('touch')).toBe(false);
  });

  const touch: KeyTouch = { id: 7, node: 'btn_play', x: 200, y: 300, pinches: 4 };

  it('presses as it lifts within a tap’s slop of where it went down', () => {
    expect(stillTap(touch, 200, 300, 4)).toBe(true);
    expect(stillTap(touch, 200 + TAP_SLOP_PX, 300, 4)).toBe(true);
    // 6 px across and 8 down is 10 px away: the edge of the slop, still a tap.
    expect(stillTap(touch, 206, 308, 4)).toBe(true);
  });

  it('is a drag, which presses nothing, once it strays past the slop', () => {
    expect(stillTap(touch, 200 + TAP_SLOP_PX + 1, 300, 4)).toBe(false);
    expect(stillTap(touch, 207, 308, 4)).toBe(false);
  });

  it('presses nothing once a pinch has begun since it went down, wherever it lifts', () => {
    expect(stillTap(touch, 200, 300, 5)).toBe(false);
  });

  it('is let go, as a knob’s turn is, once a second finger lands, though it lifts again first', () => {
    // The camera counts the pinches begun (interaction.pinches): a second finger that lands and
    // lifts before this one still began one, and the count never goes back.
    expect(pinchedSince(4, 4)).toBe(false);
    expect(pinchedSince(4, 5)).toBe(true);
    expect(pinchedSince(4, 6)).toBe(true);
    expect(stillTap(touch, 200, 300, 6)).toBe(false);
  });
});

describe('scrubTargetMs', () => {
  it('is the position with no turn going on', () => {
    expect(scrubTargetMs(10_000, 30_000, null)).toBe(10_000);
  });
  it('adds the turn, held between 0 and the duration', () => {
    expect(scrubTargetMs(10_000, 30_000, 5_000)).toBe(15_000);
    expect(scrubTargetMs(10_000, 30_000, -20_000)).toBe(0);
    expect(scrubTargetMs(25_000, 30_000, 10_000)).toBe(30_000);
  });
  it('holds only the floor while the duration is unknown', () => {
    expect(scrubTargetMs(10_000, 0, 5_000)).toBe(15_000);
    expect(scrubTargetMs(1_000, 0, -5_000)).toBe(0);
  });
});

describe('knobTakesTurn', () => {
  it('turns only while the door is shut and no change runs', () => {
    expect(knobTakesTurn(0, false)).toBe(true);
    expect(knobTakesTurn(0.01, false)).toBe(false);
    expect(knobTakesTurn(1, false)).toBe(false);
    expect(knobTakesTurn(0, true)).toBe(false);
  });
});

describe('foldTurn', () => {
  it('adds a finished turn to the spin, within one revolution', () => {
    expect(foldTurn(1, 0.5)).toBeCloseTo(1.5, 12);
    expect(foldTurn(6, 1)).toBeCloseTo(7 - 2 * Math.PI, 12);
    expect(foldTurn(0.5, -1)).toBeCloseTo(2 * Math.PI - 0.5, 12);
  });
});
