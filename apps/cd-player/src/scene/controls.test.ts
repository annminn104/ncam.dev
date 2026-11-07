import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  BUTTON_ACTIONS,
  BUTTON_NODES,
  hitFor,
  knobSeekMs,
  PRESS_MS,
  pressDepth,
} from './controls';
import { REQUIRED_NODES } from './contract';

type Node = { name: string; parent: Node | null };
const chain = (...names: string[]): Node => {
  let node: Node | null = null;
  for (const name of names) node = { name, parent: node };
  return node!;
};

describe('controls', () => {
  it('finds the key or the knob above a hit mesh', () => {
    expect(hitFor(chain('player', 'btn_play', 'player_btn_cap_play'))).toEqual({
      kind: 'button',
      node: 'btn_play',
      action: { type: 'toggle' },
    });
    expect(hitFor(chain('player', 'knob', 'player_knob_body'))).toEqual({ kind: 'knob' });
    expect(hitFor(chain('player', 'player_frame'))).toBeNull();
    expect(hitFor(null)).toBeNull();
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
