import { describe, expect, it } from 'vitest';
import { bootReducer, INITIAL_BOOT, type BootState } from './boot';

const retryable = { message: 'try', retry: true };
const final = { message: 'reload', retry: false };

describe('bootReducer', () => {
  it('starts from the poster by a click or by itself', () => {
    expect(bootReducer(INITIAL_BOOT, { type: 'start' }).phase).toBe('booting');
    expect(bootReducer(INITIAL_BOOT, { type: 'autostart' }).phase).toBe('booting');
  });

  it('goes live on the first frame, only while booting', () => {
    const booting = bootReducer(INITIAL_BOOT, { type: 'start' });
    expect(bootReducer(booting, { type: 'ready' }).phase).toBe('live');
    expect(bootReducer(INITIAL_BOOT, { type: 'ready' })).toBe(INITIAL_BOOT);
  });

  it('shows a failure while booting or once live (a context lost for good)', () => {
    const booting = bootReducer(INITIAL_BOOT, { type: 'start' });
    const live = bootReducer(booting, { type: 'ready' });
    expect(bootReducer(booting, { type: 'fail', failure: retryable })).toEqual({
      phase: 'error',
      failure: retryable,
    });
    expect(bootReducer(live, { type: 'fail', failure: retryable }).phase).toBe('error');
    expect(bootReducer(INITIAL_BOOT, { type: 'fail', failure: retryable })).toBe(INITIAL_BOOT);
  });

  it('retries a failure that can be retried, never one that needs a reload', () => {
    const error: BootState = { phase: 'error', failure: retryable };
    expect(bootReducer(error, { type: 'start' })).toEqual({ phase: 'booting', failure: null });
    const stuck: BootState = { phase: 'error', failure: final };
    expect(bootReducer(stuck, { type: 'start' })).toBe(stuck);
  });

  it('never autostarts after the visitor has seen a failure', () => {
    const error: BootState = { phase: 'error', failure: retryable };
    expect(bootReducer(error, { type: 'autostart' })).toBe(error);
  });
});
