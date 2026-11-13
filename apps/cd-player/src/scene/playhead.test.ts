import { describe, expect, it } from 'vitest';
import type { TrackView } from '../bridge';
import { createPlayhead, PLAYHEAD_HOLD_MS, type PlayheadView } from './playhead';

const track = (id: string): TrackView => ({
  id,
  title: id,
  artists: 'A',
  artUrl: null,
  artistUrl: null,
});
const view = (over: Partial<PlayheadView> = {}): PlayheadView => ({
  current: track('a'),
  status: 'playing',
  positionMs: 10_000,
  durationMs: 60_000,
  ...over,
});

describe('the playhead', () => {
  it('carries the position on frame by frame while playing, from where the embed last put it', () => {
    const head = createPlayhead();
    expect(head.read(view(), 1000)).toBe(10_000);
    expect(head.read(view(), 1250)).toBe(10_250);
    expect(head.read(view({ positionMs: 10_400 }), 1400)).toBe(10_400);
    expect(head.read(view({ positionMs: 10_400 }), 1500)).toBe(10_500);
  });

  it('holds still while paused, idle or changing discs', () => {
    for (const status of ['paused', 'idle', 'swapping'] as const) {
      const head = createPlayhead();
      head.read(view({ status }), 0);
      expect(head.read(view({ status }), 800), status).toBe(10_000);
    }
  });

  it('holds at the duration, and carries on no longer than PLAYHEAD_HOLD_MS past a report', () => {
    const end = createPlayhead();
    end.read(view({ positionMs: 59_900 }), 0);
    expect(end.read(view({ positionMs: 59_900 }), 500)).toBe(60_000);
    const quiet = createPlayhead();
    quiet.read(view(), 0);
    expect(quiet.read(view(), 9_000)).toBe(10_000 + PLAYHEAD_HOLD_MS);
  });

  it('starts afresh for a new track at the same position, and for a new status', () => {
    const head = createPlayhead();
    head.read(view(), 0);
    expect(head.read(view(), 900)).toBe(10_900);
    expect(head.read(view({ current: track('b') }), 1000)).toBe(10_000);
    expect(head.read(view({ status: 'paused' }), 1100)).toBe(10_000);
    expect(head.read(view(), 1200)).toBe(10_000);
    expect(head.read(view(), 1300)).toBe(10_100);
  });
});
