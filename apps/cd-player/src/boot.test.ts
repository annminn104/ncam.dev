import { describe, expect, it } from 'vitest';
import { bootReducer, INITIAL_BOOT } from './boot';

const failure = { message: 'x', retry: true };

describe('bootReducer', () => {
  it('starts waiting, with no failure, and only a start or an autostart leaves it', () => {
    expect(INITIAL_BOOT).toEqual({ phase: 'waiting', failure: null });
    expect(bootReducer(INITIAL_BOOT, { type: 'ready' })).toBe(INITIAL_BOOT);
    expect(bootReducer(INITIAL_BOOT, { type: 'fail', failure })).toBe(INITIAL_BOOT);
  });

  it('walks waiting → booting → live, and back to booting from a retryable error', () => {
    const booting = bootReducer(INITIAL_BOOT, { type: 'start' });
    expect(booting.phase).toBe('booting');
    expect(bootReducer(booting, { type: 'ready' }).phase).toBe('live');
    const failed = bootReducer(booting, { type: 'fail', failure });
    expect(failed).toEqual({ phase: 'error', failure });
    expect(bootReducer(failed, { type: 'start' }).phase).toBe('booting');
    expect(bootReducer(failed, { type: 'autostart' }).phase).toBe('error');
  });

  it('autostarts from waiting only', () => {
    const booting = bootReducer(INITIAL_BOOT, { type: 'autostart' });
    expect(booting).toEqual({ phase: 'booting', failure: null });
    expect(bootReducer(booting, { type: 'autostart' })).toBe(booting);
    const live = bootReducer(booting, { type: 'ready' });
    expect(bootReducer(live, { type: 'autostart' })).toBe(live);
  });

  it('stays in the error of a failure that cannot be retried, whatever starts it', () => {
    const final = { phase: 'error' as const, failure: { message: 'x', retry: false } };
    expect(bootReducer(final, { type: 'start' })).toBe(final);
    expect(bootReducer(final, { type: 'autostart' })).toBe(final);
  });
});
