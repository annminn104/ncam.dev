import { describe, expect, it } from 'vitest';
import { bootReducer, INITIAL_BOOT } from './boot';

const failure = { message: 'x', retry: true };

describe('bootReducer', () => {
  it('walks poster → booting → live, and back to booting from a retryable error', () => {
    const booting = bootReducer(INITIAL_BOOT, { type: 'start' });
    expect(booting.phase).toBe('booting');
    expect(bootReducer(booting, { type: 'ready' }).phase).toBe('live');
    const failed = bootReducer(booting, { type: 'fail', failure });
    expect(failed).toEqual({ phase: 'error', failure });
    expect(bootReducer(failed, { type: 'start' }).phase).toBe('booting');
    expect(bootReducer(failed, { type: 'autostart' }).phase).toBe('error');
  });

  it('stays in the error of a failure that cannot be retried, whatever starts it', () => {
    const final = { phase: 'error' as const, failure: { message: 'x', retry: false } };
    expect(bootReducer(final, { type: 'start' })).toBe(final);
    expect(bootReducer(final, { type: 'autostart' })).toBe(final);
  });
});
