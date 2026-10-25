export type LevelId = 1 | 2 | 3 | 4 | 5;

export interface Level {
  id: LevelId;
  name: string;
  /** Stockfish `Skill Level` option, 0–20. */
  skill: number;
  /** `go movetime`, ms. */
  movetime: number;
}

export const LEVELS: readonly Level[] = [
  { id: 1, name: 'Outer Disciple', skill: 0, movetime: 100 },
  { id: 2, name: 'Inner Disciple', skill: 5, movetime: 200 },
  { id: 3, name: 'Core Disciple', skill: 10, movetime: 400 },
  { id: 4, name: 'Elder', skill: 15, movetime: 800 },
  { id: 5, name: 'Immortal', skill: 20, movetime: 1500 },
];

export function levelOf(id: number): Level {
  const i = Math.min(5, Math.max(1, Math.floor(id || 1)));
  return LEVELS[i - 1];
}
