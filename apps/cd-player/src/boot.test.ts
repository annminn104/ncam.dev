import { describe, expect, it, vi } from 'vitest';
import { BOOT_STALL_MS, bootReducer, INITIAL_BOOT, watchStall } from './boot';
import { fakeClock } from './testing/clock';

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

describe('watchStall', () => {
  it("fails a boot that hears nothing for BOOT_STALL_MS, waiting on the scene's code", () => {
    expect(BOOT_STALL_MS).toBe(20_000);
    const t = fakeClock();
    const stalled = vi.fn();
    watchStall(stalled, t.clock);
    t.advance(BOOT_STALL_MS - 1);
    expect(stalled).not.toHaveBeenCalled();
    t.advance(1);
    expect(stalled).toHaveBeenCalledTimes(1);
    expect(stalled).toHaveBeenCalledWith('scene');
  });

  it("names the model's download once it has reported, from its request going out", () => {
    const t = fakeClock();
    const stalled = vi.fn();
    const watch = watchStall(stalled, t.clock);
    t.advance(15_000);
    // The scene's code has come: the GLB's request goes out, and nothing answers it.
    watch.progress(null);
    t.advance(BOOT_STALL_MS - 1);
    expect(stalled).not.toHaveBeenCalled();
    t.advance(1);
    expect(stalled).toHaveBeenCalledTimes(1);
    expect(stalled).toHaveBeenCalledWith('model');
  });

  it('waits again from every progress event: a fraction, 0.99 included, or none', () => {
    const t = fakeClock();
    const stalled = vi.fn();
    const watch = watchStall(stalled, t.clock);
    t.advance(15_000);
    watch.progress(0.2);
    t.advance(15_000);
    watch.progress(null);
    t.advance(15_000);
    // A chunk's count is never the end, the last chunk's or one past a compressed length alike.
    watch.progress(0.99);
    t.advance(BOOT_STALL_MS - 1);
    expect(stalled).not.toHaveBeenCalled();
    t.advance(1);
    expect(stalled).toHaveBeenCalledTimes(1);
    expect(stalled).toHaveBeenCalledWith('model');
  });

  it('waits on the parse and the compile once the download is complete, naming the compile', () => {
    // They say nothing as they go: together they must land within BOOT_STALL_MS of its end.
    const t = fakeClock();
    const stalled = vi.fn();
    const watch = watchStall(stalled, t.clock);
    watch.progress(0.5);
    watch.progress(1);
    t.advance(BOOT_STALL_MS - 1);
    expect(stalled).not.toHaveBeenCalled();
    t.advance(1);
    expect(stalled).toHaveBeenCalledTimes(1);
    expect(stalled).toHaveBeenCalledWith('compile');
  });

  it('is over once stopped after the download: the model took the stage', () => {
    const t = fakeClock();
    const stalled = vi.fn();
    const watch = watchStall(stalled, t.clock);
    watch.progress(1);
    t.advance(BOOT_STALL_MS - 1);
    watch.stop();
    expect(t.pending()).toBe(0);
    t.advance(10 * BOOT_STALL_MS);
    expect(stalled).not.toHaveBeenCalled();
  });

  it('watches a download that begins after the last one ended, as the model chosen meanwhile', () => {
    // A model chosen while the boot's own parses and compiles: its download is the boot's now.
    const t = fakeClock();
    const stalled = vi.fn();
    const watch = watchStall(stalled, t.clock);
    watch.progress(1);
    t.advance(15_000);
    watch.progress(null);
    t.advance(BOOT_STALL_MS - 1);
    expect(stalled).not.toHaveBeenCalled();
    t.advance(1);
    expect(stalled).toHaveBeenCalledTimes(1);
    expect(stalled).toHaveBeenCalledWith('model');
  });

  it('waits on the part it is told to start from: a change of model, on its download', () => {
    const t = fakeClock();
    const stalled = vi.fn();
    watchStall(stalled, t.clock, BOOT_STALL_MS, 'model');
    t.advance(BOOT_STALL_MS);
    expect(stalled).toHaveBeenCalledWith('model');
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
