import { describe, expect, it } from 'vitest';
import { bootReducer, failureMessage, GENERIC_FAILURE, INITIAL_BOOT, type BootState } from './boot';

const at = (phase: BootState['phase'], extra: Partial<BootState> = {}): BootState => ({
  ...INITIAL_BOOT,
  phase,
  ...extra,
});

describe('bootReducer', () => {
  it('starts on the poster', () => {
    expect(INITIAL_BOOT).toEqual({ phase: 'poster', error: null, queued: [] });
  });

  it('boots on start and goes live on ready', () => {
    const booting = bootReducer(INITIAL_BOOT, { type: 'start' });
    expect(booting.phase).toBe('booting');
    expect(bootReducer(booting, { type: 'ready' }).phase).toBe('live');
  });

  it('ignores ready outside booting', () => {
    for (const phase of ['poster', 'live', 'error'] as const) {
      const state = at(phase);
      expect(bootReducer(state, { type: 'ready' })).toBe(state);
    }
  });

  it('boots on autostart from the poster', () => {
    expect(bootReducer(INITIAL_BOOT, { type: 'autostart' })).toEqual({
      phase: 'booting',
      error: null,
      queued: [],
    });
  });

  it('never autostarts over a failure, a boot under way or the live scene', () => {
    // Retrying after an error is the visitor's call (Try again), not the page's.
    for (const phase of ['booting', 'live', 'error'] as const) {
      const state = at(phase, phase === 'error' ? { error: 'No WebGL2.' } : {});
      expect(bootReducer(state, { type: 'autostart' })).toBe(state);
    }
  });

  it('ignores a second start while booting or live', () => {
    for (const phase of ['booting', 'live'] as const) {
      const state = at(phase);
      expect(bootReducer(state, { type: 'start' })).toBe(state);
    }
  });

  it('shows the failure, then retries from it with the message cleared', () => {
    const failed = bootReducer(at('booting'), { type: 'fail', message: 'No WebGL2.' });
    expect(failed).toEqual({ phase: 'error', error: 'No WebGL2.', queued: [] });
    expect(bootReducer(failed, { type: 'start' })).toEqual({
      phase: 'booting',
      error: null,
      queued: [],
    });
  });

  it('ignores a failure once the scene is live', () => {
    const state = at('live');
    expect(bootReducer(state, { type: 'fail', message: 'late' })).toBe(state);
  });

  it('queues shortcuts until live, keeps them through ready, and drains them', () => {
    let state = bootReducer(INITIAL_BOOT, { type: 'start' });
    state = bootReducer(state, { type: 'queue', key: 'door' });
    state = bootReducer(state, { type: 'queue', key: 'cruise' });
    expect(state.queued).toEqual(['door', 'cruise']);
    state = bootReducer(state, { type: 'ready' });
    expect(state).toEqual({ phase: 'live', error: null, queued: ['door', 'cruise'] });
    expect(bootReducer(state, { type: 'drain' }).queued).toEqual([]);
  });

  it('drops queued shortcuts when the boot fails', () => {
    const state = at('booting', { queued: ['door'] });
    expect(bootReducer(state, { type: 'fail', message: 'x' }).queued).toEqual([]);
  });

  it('does not queue once live or on the error screen', () => {
    for (const phase of ['live', 'error'] as const) {
      const state = at(phase);
      expect(bootReducer(state, { type: 'queue', key: 'door' })).toBe(state);
    }
  });

  it('drains nothing when nothing is queued', () => {
    const state = at('live');
    expect(bootReducer(state, { type: 'drain' })).toBe(state);
  });
});

describe('failureMessage', () => {
  it("shows a GLError's own words", () => {
    const error = new Error("This browser doesn't support WebGL2, which the diorama needs.");
    error.name = 'GLError';
    expect(failureMessage(error)).toBe(error.message);
  });

  it('shows a generic line for anything else', () => {
    expect(failureMessage(new TypeError('Failed to fetch dynamically imported module'))).toBe(
      GENERIC_FAILURE,
    );
    expect(failureMessage('boom')).toBe(GENERIC_FAILURE);
    const empty = new Error('');
    empty.name = 'GLError';
    expect(failureMessage(empty)).toBe(GENERIC_FAILURE);
  });
});
