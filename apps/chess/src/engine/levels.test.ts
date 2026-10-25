import { describe, expect, it } from 'vitest';
import { LEVELS, levelOf } from './levels';

describe('levels', () => {
  it('matches the spec table', () => {
    expect(LEVELS.map((l) => [l.id, l.name, l.skill, l.movetime])).toEqual([
      [1, 'Outer Disciple', 0, 100],
      [2, 'Inner Disciple', 5, 200],
      [3, 'Core Disciple', 10, 400],
      [4, 'Elder', 15, 800],
      [5, 'Immortal', 20, 1500],
    ]);
  });
  it('clamps unknown ids', () => {
    expect(levelOf(0).id).toBe(1);
    expect(levelOf(9).id).toBe(5);
    expect(levelOf(3.7).id).toBe(3);
  });
});
