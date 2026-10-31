import { describe, expect, it, vi } from 'vitest';
import { BOOT_STALL_MS, bootReducer, INITIAL_BOOT, watchStall, type StallClock } from './boot';

const failure = { message: 'x', retry: true };

/** A clock the test moves by hand: `advance` runs the timers that fall due. */
function fakeClock() {
  let now = 0;
  let timers: { at: number; done(): void }[] = [];
  const clock: StallClock = {
    after: (ms, done) => {
      const timer = { at: now + ms, done };
      timers.push(timer);
      return () => {
        timers = timers.filter((other) => other !== timer);
      };
    },
  };
  return {
    clock,
    advance(ms: number): void {
      now += ms;
      const due = timers.filter((timer) => timer.at <= now);
      timers = timers.filter((timer) => timer.at > now);
      for (const timer of due) timer.done();
    },
    /** The timers still set. */
    pending: () => timers.length,
  };
}

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

describe('watchStall', () => {
  it('fails a boot that hears nothing from the download for BOOT_STALL_MS', () => {
    expect(BOOT_STALL_MS).toBe(20_000);
    const t = fakeClock();
    const stalled = vi.fn();
    watchStall(stalled, t.clock);
    t.advance(BOOT_STALL_MS - 1);
    expect(stalled).not.toHaveBeenCalled();
    t.advance(1);
    expect(stalled).toHaveBeenCalledTimes(1);
  });

  it('waits again from every progress event, a fraction or none (no Content-Length)', () => {
    const t = fakeClock();
    const stalled = vi.fn();
    const watch = watchStall(stalled, t.clock);
    t.advance(15_000);
    watch.progress(0.2);
    t.advance(15_000);
    watch.progress(null);
    t.advance(BOOT_STALL_MS - 1);
    expect(stalled).not.toHaveBeenCalled();
    t.advance(1);
    expect(stalled).toHaveBeenCalledTimes(1);
  });

  it('ends once the download is complete: the shaders compile after it without a word', () => {
    const t = fakeClock();
    const stalled = vi.fn();
    const watch = watchStall(stalled, t.clock);
    watch.progress(0.5);
    watch.progress(1);
    expect(t.pending()).toBe(0);
    // A compressed transfer counted past its length reports 1 again: that arms nothing.
    watch.progress(1);
    t.advance(10 * BOOT_STALL_MS);
    expect(stalled).not.toHaveBeenCalled();
    expect(t.pending()).toBe(0);
  });

  it('ends with the boot, and hears nothing after', () => {
    const t = fakeClock();
    const stalled = vi.fn();
    const watch = watchStall(stalled, t.clock);
    t.advance(5_000);
    watch.stop();
    expect(t.pending()).toBe(0);
    watch.progress(0.3);
    t.advance(2 * BOOT_STALL_MS);
    expect(stalled).not.toHaveBeenCalled();
    expect(t.pending()).toBe(0);
  });

  it('fails the boot once: a late event from the download it gave up on arms nothing', () => {
    const t = fakeClock();
    const stalled = vi.fn();
    const watch = watchStall(stalled, t.clock);
    t.advance(BOOT_STALL_MS);
    watch.progress(0.4);
    t.advance(2 * BOOT_STALL_MS);
    expect(stalled).toHaveBeenCalledTimes(1);
    expect(t.pending()).toBe(0);
  });
});
