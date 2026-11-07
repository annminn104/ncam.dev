import { describe, expect, it, vi, type Mock } from 'vitest';
import { BOOT_STALL_MS } from '../boot';
import { ModelStallError } from '../failure';
import type { ModelId } from '../models';
import { fakeClock } from '../testing/clock';
import { startModelLoad, type ModelLoadEvents } from './model-load';

interface Model {
  id: ModelId;
  dispose: Mock<() => void>;
}

const model = (id: ModelId = 'clear'): Model => ({ id, dispose: vi.fn<() => void>() });

/** A load the test drives: its download's progress, then the model or an error. */
function fakeLoad() {
  let onProgress: (fraction: number | null) => void = () => {};
  let signal: AbortSignal | null = null;
  let settle: { resolve(model: Model): void; reject(error: unknown): void } | null = null;
  const load = vi.fn((report: (fraction: number | null) => void, abort: AbortSignal) => {
    onProgress = report;
    signal = abort;
    return new Promise<Model>((resolve, reject) => {
      settle = { resolve, reject };
    });
  });
  return {
    load,
    progress: (fraction: number | null) => onProgress(fraction),
    aborted: () => signal?.aborted ?? false,
    /** Lands the model, and lets the load's own handlers run. */
    async land(landed: Model) {
      settle?.resolve(landed);
      await Promise.resolve();
      await Promise.resolve();
    },
    async fail(error: unknown) {
      settle?.reject(error);
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

function events() {
  return {
    progress: vi.fn<ModelLoadEvents<Model>['progress']>(),
    landed: vi.fn<ModelLoadEvents<Model>['landed']>(),
    failed: vi.fn<ModelLoadEvents<Model>['failed']>(),
    abandon: vi.fn<ModelLoadEvents<Model>['abandon']>(),
  };
}

describe('startModelLoad, a change of model', () => {
  it('reports its download, hands over its model, and fails nothing once compiled in time', async () => {
    const t = fakeClock();
    const f = fakeLoad();
    const on = events();
    const run = startModelLoad(f.load, on, t.clock);
    f.progress(null);
    f.progress(0.5);
    f.progress(1);
    expect(on.progress.mock.calls).toEqual([[null], [0.5], [1]]);
    const clear = model();
    await f.land(clear);
    expect(on.landed).toHaveBeenCalledWith(clear);
    t.advance(BOOT_STALL_MS - 1);
    run.compiled(clear);
    expect(t.pending()).toBe(0);
    t.advance(10 * BOOT_STALL_MS);
    expect(on.failed).not.toHaveBeenCalled();
    expect(clear.dispose).not.toHaveBeenCalled();
  });

  it('fails as stalled on BOOT_STALL_MS without a word from its download, and stops it', async () => {
    const t = fakeClock();
    const f = fakeLoad();
    const on = events();
    startModelLoad(f.load, on, t.clock);
    f.progress(null);
    t.advance(BOOT_STALL_MS - 1);
    expect(on.failed).not.toHaveBeenCalled();
    t.advance(1);
    expect(on.failed).toHaveBeenCalledOnce();
    const error = on.failed.mock.calls[0][0];
    expect(error).toBeInstanceOf(ModelStallError);
    expect((error as ModelStallError).part).toBe('model');
    expect(f.aborted()).toBe(true);
    expect(on.abandon).not.toHaveBeenCalled();
    // It says nothing more, and a model that lands anyway goes at once.
    f.progress(0.5);
    const late = model();
    await f.land(late);
    expect(on.progress.mock.calls).toEqual([[null]]);
    expect(on.landed).not.toHaveBeenCalled();
    expect(late.dispose).toHaveBeenCalledOnce();
    expect(on.failed).toHaveBeenCalledOnce();
  });

  it('waits on its download from the start, before its first word (the scene’s code is here)', () => {
    const t = fakeClock();
    const on = events();
    startModelLoad(fakeLoad().load, on, t.clock);
    t.advance(BOOT_STALL_MS);
    expect((on.failed.mock.calls[0][0] as ModelStallError).part).toBe('model');
  });

  it('waits again from every word of the download, a size unknown or a fraction', () => {
    const t = fakeClock();
    const f = fakeLoad();
    const on = events();
    startModelLoad(f.load, on, t.clock);
    f.progress(null);
    t.advance(15_000);
    f.progress(0.3);
    t.advance(15_000);
    f.progress(null);
    t.advance(15_000);
    f.progress(0.99);
    t.advance(BOOT_STALL_MS - 1);
    expect(on.failed).not.toHaveBeenCalled();
    t.advance(1);
    expect((on.failed.mock.calls[0][0] as ModelStallError).part).toBe('model');
  });

  it('waits on its parse and compile for BOOT_STALL_MS from the download’s end, then lets its model go', async () => {
    // The parse and the compile say nothing: the model landing is not a word.
    const t = fakeClock();
    const f = fakeLoad();
    const on = events();
    const run = startModelLoad(f.load, on, t.clock);
    f.progress(null);
    f.progress(1);
    t.advance(15_000);
    const clear = model();
    await f.land(clear);
    t.advance(BOOT_STALL_MS - 15_000 - 1);
    expect(on.failed).not.toHaveBeenCalled();
    t.advance(1);
    // A compile that never settles (a context that no longer answers): its model goes, never shown.
    expect(on.abandon).toHaveBeenCalledWith(clear);
    expect((on.failed.mock.calls[0][0] as ModelStallError).part).toBe('compile');
    // The compile landing late is too late: nothing more is said.
    run.compiled(clear);
    expect(on.failed).toHaveBeenCalledOnce();
    expect(on.abandon).toHaveBeenCalledOnce();
  });

  it('keeps watching through the compile of a model it did not load', async () => {
    const t = fakeClock();
    const f = fakeLoad();
    const on = events();
    const run = startModelLoad(f.load, on, t.clock);
    f.progress(1);
    await f.land(model());
    run.compiled(model());
    t.advance(BOOT_STALL_MS);
    expect(on.failed).toHaveBeenCalledOnce();
  });

  it('passes a load’s own failure on once, and leaves no watch behind', async () => {
    const t = fakeClock();
    const f = fakeLoad();
    const on = events();
    startModelLoad(f.load, on, t.clock);
    f.progress(null);
    const error = new Error('cd-player-clear.glb answered 404');
    await f.fail(error);
    expect(on.failed.mock.calls).toEqual([[error]]);
    expect(t.pending()).toBe(0);
    t.advance(2 * BOOT_STALL_MS);
    expect(on.failed).toHaveBeenCalledOnce();
  });

  it('turns a failure that is no Error into one', async () => {
    const f = fakeLoad();
    const on = events();
    startModelLoad(f.load, on, fakeClock().clock);
    await f.fail('offline');
    expect(on.failed.mock.calls[0][0]).toEqual(new Error('offline'));
  });

  it('says nothing once let go of: no word, no failure, its download stopped', async () => {
    const t = fakeClock();
    const f = fakeLoad();
    const on = events();
    const run = startModelLoad(f.load, on, t.clock);
    f.progress(null);
    run.cancel();
    expect(f.aborted()).toBe(true);
    expect(t.pending()).toBe(0);
    f.progress(0.4);
    t.advance(2 * BOOT_STALL_MS);
    await f.fail(new DOMException('aborted', 'AbortError'));
    expect(on.progress.mock.calls).toEqual([[null]]);
    expect(on.failed).not.toHaveBeenCalled();
  });

  it('disposes a model that lands once it was let go of, and hands it to no one', async () => {
    const f = fakeLoad();
    const on = events();
    const run = startModelLoad(f.load, on, fakeClock().clock);
    run.cancel();
    const late = model();
    await f.land(late);
    expect(late.dispose).toHaveBeenCalledOnce();
    expect(on.landed).not.toHaveBeenCalled();
  });
});

describe('startModelLoad, the boot’s load', () => {
  it('is never watched here (App watches the boot): its words and its failure pass straight on', async () => {
    vi.useFakeTimers();
    const f = fakeLoad();
    const on = events();
    startModelLoad(f.load, on, null);
    f.progress(null);
    // No timer of its own: the page's timers find nothing set.
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
    f.progress(1);
    expect(on.progress.mock.calls).toEqual([[null], [1]]);
    const error = new Error('the model is missing knob');
    await f.fail(error);
    expect(on.failed.mock.calls).toEqual([[error]]);
    expect(on.abandon).not.toHaveBeenCalled();
  });
});
