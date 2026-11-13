import { describe, expect, it } from 'vitest';
import { grips } from './grip';

/** A grip whose maths note what they are asked; a press left of x = 0 begins nothing. */
function setup() {
  const state = { takes: true };
  const calls: string[] = [];
  const g = grips<{ moves: number }>({
    takes: () => state.takes,
    begin: (x, y) => {
      if (x < 0) return null;
      calls.push(`begin ${x},${y}`);
      return { moves: 0 };
    },
    move: (hold, x, y) => {
      hold.moves += 1;
      calls.push(`move ${x},${y}`);
    },
    release: (hold) => calls.push(`release after ${hold.moves}`),
    abandon: (hold) => calls.push(`abandon after ${hold.moves}`),
    stop: (hold) => calls.push(`stop after ${hold.moves}`),
  });
  return { g, calls, state };
}

describe('grips', () => {
  it('begins on a press it takes, follows that pointer alone, and releases once as it lifts', () => {
    const { g, calls } = setup();
    g.down(1, 2, 3, 0);
    g.move(2, 9, 9, 0, false);
    g.move(1, 4, 5, 0, false);
    g.up(2, 0);
    g.up(1, 0);
    g.up(1, 0);
    expect(calls).toEqual(['begin 2,3', 'move 4,5', 'release after 1']);
  });

  it('begins nothing on a press it does not take, or that its maths refuse', () => {
    const { g, calls, state } = setup();
    g.down(1, -1, 0, 0);
    state.takes = false;
    g.down(2, 1, 0, 0);
    g.move(2, 1, 1, 0, false);
    g.up(2, 0);
    expect(calls).toEqual([]);
  });

  it.each([
    ['cancelled', (g: ReturnType<typeof setup>['g']) => g.cancel(1)],
    ['with its release lost', (g: ReturnType<typeof setup>['g']) => g.move(1, 5, 5, 0, true)],
    ['become a pinch on a move', (g: ReturnType<typeof setup>['g']) => g.move(1, 5, 5, 1, false)],
    ['become a pinch on the lift', (g: ReturnType<typeof setup>['g']) => g.up(1, 1)],
  ])('abandons a grip %s, and never releases it', (_, end) => {
    const { g, calls } = setup();
    g.down(1, 0, 0, 0);
    g.move(1, 1, 1, 0, false);
    end(g);
    g.up(1, 0);
    expect(calls).toEqual(['begin 0,0', 'move 1,1', 'abandon after 1']);
  });

  it('stops a grip no longer taken at the next frame or event, and never releases it', () => {
    for (const next of ['frame', 'move', 'up'] as const) {
      const { g, calls, state } = setup();
      g.down(1, 0, 0, 0);
      state.takes = false;
      if (next === 'frame') g.frame();
      if (next === 'move') g.move(1, 1, 1, 0, false);
      if (next === 'up') g.up(1, 0);
      g.up(1, 0);
      expect(calls, next).toEqual(['begin 0,0', 'stop after 0']);
    }
  });
});
