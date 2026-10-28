import { describe, expect, it } from 'vitest';
import type { Track } from '../spotify/types';
import {
  currentIndex,
  initialSeq,
  shuffled,
  step,
  upcomingIndices,
  type SeqEvent,
  type SeqState,
} from './sequencer';

const track = (id: string, playable = true): Track => ({
  id,
  uri: `spotify:track:${id}`,
  title: id,
  artists: 'Artist',
  durationMs: 180_000,
  playable,
  explicit: false,
});
const TRACKS = [track('a'), track('b', false), track('c'), track('d')];

const run = (state: SeqState, ...events: SeqEvent[]) =>
  events.reduce((s, event) => step(s, event).state, state);
const loaded = () => run(initialSeq(), { type: 'LOAD', tracks: TRACKS });
const playingAt = (index: number) =>
  run(loaded(), { type: 'SELECT', index }, { type: 'SWAP_DONE' });

describe('sequencer', () => {
  it('PLAY from idle swaps in the first playable track, SWAP_DONE loads it', () => {
    const play = step(loaded(), { type: 'PLAY' });
    expect(play.state.status).toBe('swapping');
    expect(currentIndex(play.state)).toBe(0);
    expect(play.commands).toEqual([{ type: 'swap', to: 0 }]);
    const done = step(play.state, { type: 'SWAP_DONE' });
    expect(done.state.status).toBe('playing');
    expect(done.commands).toEqual([{ type: 'load', uri: 'spotify:track:a' }]);
  });

  it('NEXT pauses the playing track, skips unplayable ones and swaps', () => {
    const next = step(playingAt(0), { type: 'NEXT' });
    expect(currentIndex(next.state)).toBe(2);
    expect(next.commands).toEqual([{ type: 'pause' }, { type: 'swap', to: 2 }]);
  });

  it('NEXT on the last track does nothing without repeat and wraps with it', () => {
    expect(step(playingAt(3), { type: 'NEXT' }).commands).toEqual([]);
    const wrapped = step(run(playingAt(3), { type: 'TOGGLE_REPEAT' }), { type: 'NEXT' });
    expect(currentIndex(wrapped.state)).toBe(0);
  });

  it('PREV restarts after three seconds, else goes back a playable track', () => {
    const late = run(playingAt(2), {
      type: 'PROGRESS',
      positionMs: 5000,
      durationMs: 180_000,
      paused: false,
    });
    expect(step(late, { type: 'PREV' }).commands).toEqual([{ type: 'seek', ms: 0 }]);
    const early = step(playingAt(2), { type: 'PREV' });
    expect(currentIndex(early.state)).toBe(0);
    expect(early.commands).toEqual([{ type: 'pause' }, { type: 'swap', to: 0 }]);
  });

  it('PREV before the first track wraps to the last playable one, only with repeat', () => {
    const idle = loaded();
    const wrapped = step(run(idle, { type: 'TOGGLE_REPEAT' }), { type: 'PREV' });
    expect(wrapped.state.status).toBe('swapping');
    expect(currentIndex(wrapped.state)).toBe(3);
    expect(wrapped.commands).toEqual([{ type: 'swap', to: 3 }]);
    const ignored = step(idle, { type: 'PREV' });
    expect(ignored.state).toBe(idle);
    expect(ignored.commands).toEqual([]);
  });

  it('ignores track changes while a disc is being changed', () => {
    const swapping = step(loaded(), { type: 'PLAY' }).state;
    for (const event of [
      { type: 'NEXT' },
      { type: 'PREV' },
      { type: 'SELECT', index: 2 },
    ] as SeqEvent[]) {
      expect(step(swapping, event).state).toBe(swapping);
    }
  });

  it('follows the embed: PROGRESS sets the time and its own pause or play', () => {
    const paused = step(playingAt(0), {
      type: 'PROGRESS',
      positionMs: 1200,
      durationMs: 30_000,
      paused: true,
    });
    expect(paused.state).toMatchObject({ status: 'paused', positionMs: 1200, durationMs: 30_000 });
    expect(paused.commands).toEqual([]);
    const swapping = step(loaded(), { type: 'PLAY' }).state;
    expect(
      step(swapping, { type: 'PROGRESS', positionMs: 1, durationMs: 1, paused: false }).state,
    ).toBe(swapping);
  });

  it('ENDED changes the disc without a pause, or idles after the last track', () => {
    const ended = step(playingAt(0), { type: 'ENDED' });
    expect(ended.commands).toEqual([{ type: 'swap', to: 2 }]);
    const last = step(playingAt(3), { type: 'ENDED' });
    expect(last.state.status).toBe('idle');
    expect(last.commands).toEqual([]);
  });

  it('PLAY after the last track reloads it in place', () => {
    const over = run(playingAt(3), { type: 'ENDED' });
    const again = step(over, { type: 'PLAY' });
    expect(again.state.status).toBe('playing');
    expect(again.commands).toEqual([{ type: 'load', uri: 'spotify:track:d' }]);
  });

  it('TOGGLE pauses and resumes, STOP rewinds and pauses', () => {
    const paused = step(playingAt(0), { type: 'TOGGLE' });
    expect(paused.commands).toEqual([{ type: 'pause' }]);
    expect(step(paused.state, { type: 'TOGGLE' }).commands).toEqual([{ type: 'resume' }]);
    const stopped = step(playingAt(0), { type: 'STOP' });
    expect(stopped.state).toMatchObject({ status: 'paused', positionMs: 0 });
    expect(stopped.commands).toEqual([{ type: 'pause' }, { type: 'seek', ms: 0 }]);
  });

  it('SELECT restarts the current track, refuses unplayable ones', () => {
    expect(step(playingAt(0), { type: 'SELECT', index: 0 }).commands).toEqual([
      { type: 'seek', ms: 0 },
    ]);
    expect(step(playingAt(0), { type: 'SELECT', index: 1 }).commands).toEqual([]);
  });

  it('SEEK clamps inside the track and only while one is loaded', () => {
    const seek = step(playingAt(0), { type: 'SEEK', ms: 999_999 });
    expect(seek.commands).toEqual([{ type: 'seek', ms: 179_000 }]);
    expect(step(loaded(), { type: 'SEEK', ms: 10 }).commands).toEqual([]);
  });

  it('shuffle keeps the current track first, and turning it off restores the order', () => {
    const on = step(playingAt(2), { type: 'TOGGLE_SHUFFLE', seed: 42 }).state;
    expect(on.shuffle).toBe(true);
    expect(on.order[0]).toBe(2);
    expect([...on.order].sort()).toEqual([0, 1, 2, 3]);
    expect(currentIndex(on)).toBe(2);
    const off = step(on, { type: 'TOGGLE_SHUFFLE', seed: 0 }).state;
    expect(off.order).toEqual([0, 1, 2, 3]);
    expect(currentIndex(off)).toBe(2);
    expect(shuffled(4, 7, null)).toEqual(shuffled(4, 7, null));
  });

  it('lists the upcoming playable tracks', () => {
    expect(upcomingIndices(loaded(), 2)).toEqual([0, 2]);
    expect(upcomingIndices(playingAt(2), 5)).toEqual([3]);
    expect(upcomingIndices(run(playingAt(2), { type: 'TOGGLE_REPEAT' }), 5)).toEqual([3, 0]);
  });

  it('LOAD resets the queue and pauses a playing embed', () => {
    const reload = step(playingAt(0), { type: 'LOAD', tracks: [track('x')] });
    expect(reload.state).toMatchObject({ cursor: -1, status: 'idle', order: [0] });
    expect(reload.commands).toEqual([{ type: 'pause' }]);
  });
});
