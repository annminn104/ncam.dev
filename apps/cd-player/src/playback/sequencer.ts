import type { Track } from '../spotify/types';

/**
 * What plays and in which order, as a pure reducer: `step(state, event)` returns the next state and
 * the commands for the world outside (the CD change in the scene, the Spotify embed). `swapping`:
 * the disc is being changed, and the track loads into the embed when the scene reports the disc
 * seated (`SWAP_DONE`), so the music starts as the tonearm lands. No I/O here.
 */
export type Status = 'idle' | 'swapping' | 'playing' | 'paused';

export interface SeqState {
  tracks: readonly Track[];
  /** Play order, as indices into `tracks`; shuffled while `shuffle`. */
  order: readonly number[];
  /** Position in `order` of the track in the player (or arriving); -1 before the first play. */
  cursor: number;
  status: Status;
  positionMs: number;
  durationMs: number;
  repeat: boolean;
  shuffle: boolean;
}

export type SeqEvent =
  | { type: 'LOAD'; tracks: readonly Track[] }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE' }
  | { type: 'SELECT'; index: number }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'STOP' }
  | { type: 'SEEK'; ms: number }
  | { type: 'SWAP_DONE' }
  | { type: 'PROGRESS'; positionMs: number; durationMs: number; paused: boolean }
  | { type: 'ENDED' }
  | { type: 'TOGGLE_REPEAT' }
  | { type: 'TOGGLE_SHUFFLE'; seed: number };

export type Command =
  /** Change the disc in the player for `tracks[to]`; answer with SWAP_DONE. */
  | { type: 'swap'; to: number }
  /** Load and play `uri` in the embed. */
  | { type: 'load'; uri: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'seek'; ms: number };

export interface Step {
  state: SeqState;
  commands: Command[];
}

/** PREV past this point restarts the track instead of going back one. */
export const RESTART_MS = 3000;

export function initialSeq(tracks: readonly Track[] = []): SeqState {
  return {
    tracks,
    order: tracks.map((_, index) => index),
    cursor: -1,
    status: 'idle',
    positionMs: 0,
    durationMs: 0,
    repeat: false,
    shuffle: false,
  };
}

export function currentIndex(state: SeqState): number | null {
  return state.cursor >= 0 && state.cursor < state.order.length ? state.order[state.cursor] : null;
}

/** The next position in `order` after `from` (stepping by `dir`) whose track plays; -1 if none. */
export function findPlayable(state: SeqState, from: number, dir: 1 | -1, wrap: boolean): number {
  const n = state.order.length;
  for (let offset = 1; offset <= n; offset++) {
    let pos = from + dir * offset;
    if (pos < 0 || pos >= n) {
      if (!wrap) return -1;
      pos = ((pos % n) + n) % n;
    }
    if (state.tracks[state.order[pos]]?.playable) return pos;
  }
  return -1;
}

/** The tracks (indices into `tracks`) that play after the current one, at most `count`. */
export function upcomingIndices(state: SeqState, count: number): number[] {
  const out: number[] = [];
  let pos = state.cursor;
  while (out.length < count) {
    pos = findPlayable(state, pos, 1, state.repeat);
    if (pos < 0 || pos === state.cursor) break;
    const index = state.order[pos];
    if (out.includes(index)) break;
    out.push(index);
  }
  return out;
}

/** A seeded Fisher-Yates order of `count` indices, with `first` moved to the front. */
export function shuffled(count: number, seed: number, first: number | null): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  let s = seed >>> 0 || 1;
  const random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (first !== null && order.includes(first)) {
    order.splice(order.indexOf(first), 1);
    order.unshift(first);
  }
  return order;
}

function swapTo(state: SeqState, pos: number): Step {
  const to = state.order[pos];
  const commands: Command[] = state.status === 'playing' ? [{ type: 'pause' }] : [];
  commands.push({ type: 'swap', to });
  return {
    state: {
      ...state,
      cursor: pos,
      status: 'swapping',
      positionMs: 0,
      durationMs: state.tracks[to].durationMs,
    },
    commands,
  };
}

const loaded = (state: SeqState) => state.status === 'playing' || state.status === 'paused';

export function step(state: SeqState, event: SeqEvent): Step {
  const none: Step = { state, commands: [] };
  switch (event.type) {
    case 'LOAD':
      return {
        state: { ...initialSeq(event.tracks), repeat: state.repeat },
        commands: state.status === 'playing' ? [{ type: 'pause' }] : [],
      };
    case 'PLAY': {
      if (state.status === 'paused')
        return { state: { ...state, status: 'playing' }, commands: [{ type: 'resume' }] };
      if (state.status !== 'idle') return none;
      const current = currentIndex(state);
      if (current !== null) {
        return {
          state: { ...state, status: 'playing', positionMs: 0 },
          commands: [{ type: 'load', uri: state.tracks[current].uri }],
        };
      }
      const pos = findPlayable(state, -1, 1, false);
      return pos < 0 ? none : swapTo(state, pos);
    }
    case 'PAUSE':
      return state.status === 'playing'
        ? { state: { ...state, status: 'paused' }, commands: [{ type: 'pause' }] }
        : none;
    case 'TOGGLE':
      return state.status === 'playing'
        ? step(state, { type: 'PAUSE' })
        : step(state, { type: 'PLAY' });
    case 'SELECT': {
      if (state.status === 'swapping') return none;
      const pos = state.order.indexOf(event.index);
      if (pos < 0 || !state.tracks[event.index]?.playable) return none;
      if (pos === state.cursor && loaded(state)) {
        const commands: Command[] = [{ type: 'seek', ms: 0 }];
        if (state.status === 'paused') commands.push({ type: 'resume' });
        return { state: { ...state, status: 'playing', positionMs: 0 }, commands };
      }
      return swapTo(state, pos);
    }
    case 'NEXT': {
      if (state.status === 'swapping') return none;
      const pos = findPlayable(state, state.cursor, 1, state.repeat);
      return pos < 0 ? none : swapTo(state, pos);
    }
    case 'PREV': {
      if (state.status === 'swapping') return none;
      if (loaded(state) && state.positionMs > RESTART_MS) {
        return { state: { ...state, positionMs: 0 }, commands: [{ type: 'seek', ms: 0 }] };
      }
      const pos = findPlayable(state, state.cursor, -1, state.repeat);
      if (pos >= 0) return swapTo(state, pos);
      return loaded(state)
        ? { state: { ...state, positionMs: 0 }, commands: [{ type: 'seek', ms: 0 }] }
        : none;
    }
    case 'STOP':
      return loaded(state)
        ? {
            state: { ...state, status: 'paused', positionMs: 0 },
            commands: [{ type: 'pause' }, { type: 'seek', ms: 0 }],
          }
        : none;
    case 'SEEK': {
      if (!loaded(state)) return none;
      const ms = Math.min(Math.max(0, event.ms), Math.max(0, state.durationMs - 1000));
      return { state: { ...state, positionMs: ms }, commands: [{ type: 'seek', ms }] };
    }
    case 'SWAP_DONE': {
      if (state.status !== 'swapping') return none;
      const current = state.tracks[state.order[state.cursor]];
      return {
        state: { ...state, status: 'playing', positionMs: 0, durationMs: current.durationMs },
        commands: [{ type: 'load', uri: current.uri }],
      };
    }
    case 'PROGRESS':
      if (!loaded(state)) return none;
      return {
        state: {
          ...state,
          positionMs: event.positionMs,
          durationMs: event.durationMs || state.durationMs,
          status: event.paused ? 'paused' : 'playing',
        },
        commands: [],
      };
    case 'ENDED': {
      if (!loaded(state)) return none;
      const pos = findPlayable(state, state.cursor, 1, state.repeat);
      if (pos < 0) return { state: { ...state, status: 'idle', positionMs: 0 }, commands: [] };
      return swapTo({ ...state, status: 'paused' }, pos);
    }
    case 'TOGGLE_REPEAT':
      return { state: { ...state, repeat: !state.repeat }, commands: [] };
    case 'TOGGLE_SHUFFLE': {
      const current = currentIndex(state);
      if (state.shuffle) {
        return {
          state: {
            ...state,
            shuffle: false,
            order: state.tracks.map((_, i) => i),
            cursor: current ?? -1,
          },
          commands: [],
        };
      }
      return {
        state: {
          ...state,
          shuffle: true,
          order: shuffled(state.tracks.length, event.seed, current),
          cursor: current === null ? -1 : 0,
        },
        commands: [],
      };
    }
  }
}
