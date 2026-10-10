import { describe, expect, it, vi } from 'vitest';
import type { WorkerLike } from './engine';
import { lazyWorker } from './lazy-worker';

/** A real-enough worker: records what it is sent. */
function recorder(log: string[]): WorkerLike {
  return {
    onmessage: null,
    onerror: null,
    postMessage: (msg) => void log.push(msg),
    terminate: vi.fn(),
  };
}

/** A load that finishes when the test says so. */
function later() {
  let arrive!: (w: WorkerLike) => void;
  let fail!: (e: unknown) => void;
  let signal!: AbortSignal;
  const load = (s: AbortSignal) => {
    signal = s;
    return new Promise<WorkerLike>((resolve, reject) => {
      arrive = resolve;
      fail = reject;
    });
  };
  return {
    load,
    arrive: (w: WorkerLike) => arrive(w),
    fail: (e: unknown) => fail(e),
    signal: () => signal,
  };
}

describe('lazyWorker', () => {
  it('holds commands until the worker arrives, then passes them on in order', async () => {
    const pending = later();
    const proxy = lazyWorker(pending.load);
    proxy.postMessage('uci');
    proxy.postMessage('isready');
    const log: string[] = [];
    pending.arrive(recorder(log));
    await proxy.loaded;
    expect(log).toEqual(['uci', 'isready']);
    proxy.postMessage('go movetime 100');
    expect(log).toEqual(['uci', 'isready', 'go movetime 100']);
  });

  it('passes the worker’s lines and errors back', async () => {
    const pending = later();
    const proxy = lazyWorker(pending.load);
    const lines: unknown[] = [];
    const errors: unknown[] = [];
    proxy.onmessage = (e) => lines.push(e.data);
    proxy.onerror = (e) => errors.push(e);
    const real = recorder([]);
    pending.arrive(real);
    await proxy.loaded;
    real.onmessage?.({ data: 'uciok' });
    const crash = new Error('wasm trap');
    real.onerror?.(crash);
    expect(lines).toEqual(['uciok']);
    expect(errors).toEqual([crash]);
  });

  it('terminates the worker it has', async () => {
    const pending = later();
    const proxy = lazyWorker(pending.load);
    const real = recorder([]);
    pending.arrive(real);
    await proxy.loaded;
    proxy.terminate();
    expect(real.terminate).toHaveBeenCalledOnce();
  });

  it('cancels the load when terminated first, and ends a worker that arrives anyway', async () => {
    const pending = later();
    const proxy = lazyWorker(pending.load);
    proxy.postMessage('uci');
    proxy.terminate();
    expect(pending.signal().aborted).toBe(true);
    const log: string[] = [];
    const real = recorder(log);
    pending.arrive(real);
    await expect(proxy.loaded).rejects.toThrow();
    expect(real.terminate).toHaveBeenCalledOnce();
    expect(log).toEqual([]);
  });

  it('rejects `loaded` when the worker cannot be made', async () => {
    const pending = later();
    const proxy = lazyWorker(pending.load);
    pending.fail(new Error('stockfish.wasm 404'));
    await expect(proxy.loaded).rejects.toThrow('stockfish.wasm 404');
  });

  it('rejects `loaded`, not throws, when the load throws at once', async () => {
    const proxy = lazyWorker(() => {
      throw new Error('no Worker here');
    });
    await expect(proxy.loaded).rejects.toThrow('no Worker here');
  });
});
