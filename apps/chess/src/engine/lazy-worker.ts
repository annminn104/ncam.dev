import type { WorkerLike } from './engine';

/**
 * A worker to hand `createEngine` now, for one that only exists once `load` resolves
 * (`spawnStockfish` downloads Stockfish first). Commands wait, in order, until it is there; its
 * lines and errors come through; `loaded` settles when it arrives, which is when the engine
 * starts its handshake clock, and rejects if it never will. Terminating before then aborts the
 * load's `signal`, and a worker that arrives anyway is terminated at once.
 */
export function lazyWorker(load: (signal: AbortSignal) => Promise<WorkerLike>): WorkerLike {
  const queue: string[] = [];
  const cancel = new AbortController();
  let real: WorkerLike | null = null;
  const proxy: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(msg) {
      if (real) real.postMessage(msg);
      else if (!cancel.signal.aborted) queue.push(msg);
    },
    terminate() {
      cancel.abort();
      queue.length = 0;
      real?.terminate();
      real = null;
    },
  };
  // async: a load that throws at once rejects `loaded` like any other failure.
  proxy.loaded = (async () => load(cancel.signal))().then((w) => {
    if (cancel.signal.aborted) {
      w.terminate();
      throw new Error('stockfish worker terminated while it loaded');
    }
    real = w;
    w.onmessage = (e) => proxy.onmessage?.(e);
    w.onerror = (e) => proxy.onerror?.(e);
    for (const msg of queue.splice(0)) w.postMessage(msg);
  });
  // Nobody waits on `loaded` once it is terminated: its rejection is no error then.
  proxy.loaded.catch(() => undefined);
  return proxy;
}
