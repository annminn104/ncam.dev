import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEngine, EngineError, type WorkerLike } from './engine';
import { levelOf } from './levels';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** A fake Stockfish: answers the handshake, and `go` with `reply` (or never). */
function fakeWorker(reply: string | null, log: string[] = []): WorkerLike {
  const w: WorkerLike = {
    onmessage: null,
    postMessage(msg) {
      log.push(msg);
      const answer = (data: string) => queueMicrotask(() => w.onmessage?.({ data }));
      if (msg === 'uci') answer('uciok');
      else if (msg === 'isready') answer('readyok');
      else if (msg.startsWith('go') && reply) answer(reply);
    },
    terminate: vi.fn(),
  };
  return w;
}

/**
 * A worker still downloading for `ms`, as `lazyWorker` hands one over: what it is sent meanwhile
 * waits (Stockfish's loader queues commands until it is ready), and `loaded` settles on arrival.
 */
function lateWorker(ms: number, reply: string | null, log: string[] = []): WorkerLike {
  const w = fakeWorker(reply, log);
  const post = w.postMessage.bind(w);
  const queue: string[] = [];
  let arrived = false;
  w.postMessage = (msg) => {
    if (arrived) post(msg);
    else queue.push(msg);
  };
  w.loaded = new Promise<void>((resolve) =>
    setTimeout(() => {
      arrived = true;
      for (const msg of queue.splice(0)) post(msg);
      resolve();
    }, ms),
  );
  return w;
}

/** A promise's outcome, readable at any point without awaiting it. */
function track<T>(p: Promise<T>) {
  const state: { done: boolean; value?: T; error?: unknown } = { done: false };
  p.then(
    (value) => Object.assign(state, { done: true, value }),
    (error: unknown) => Object.assign(state, { done: true, error }),
  );
  return state;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createEngine', () => {
  it('handshakes, configures the level and returns the best move', async () => {
    const log: string[] = [];
    const engine = createEngine(() => fakeWorker('bestmove e2e4', log));
    await expect(engine.bestMove(START, levelOf(3))).resolves.toEqual({ from: 'e2', to: 'e4' });
    expect(log).toEqual([
      'uci',
      'isready',
      'setoption name Skill Level value 10',
      `position fen ${START}`,
      'go movetime 400',
    ]);
  });

  it('restarts a silent engine once, then gives up with a timeout', async () => {
    const spawned: WorkerLike[] = [];
    const engine = createEngine(() => {
      const w = fakeWorker(null);
      spawned.push(w);
      return w;
    });
    const result = engine.bestMove(START, levelOf(1)).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await result;
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).reason).toBe('timeout');
    expect(spawned).toHaveLength(2);
    expect(spawned[0].terminate).toHaveBeenCalled();
  });

  it('recovers when the restarted engine answers', async () => {
    let n = 0;
    const engine = createEngine(() => fakeWorker(n++ === 0 ? null : 'bestmove g1f3'));
    const result = engine.bestMove(START, levelOf(1));
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(result).resolves.toEqual({ from: 'g1', to: 'f3' });
  });

  it('rejects after dispose', async () => {
    const engine = createEngine(() => fakeWorker('bestmove e2e4'));
    engine.dispose();
    await expect(engine.bestMove(START, levelOf(1))).rejects.toMatchObject({ reason: 'disposed' });
  });

  it('serialises concurrent calls: the second waits for the first bestmove', async () => {
    const log: string[] = [];
    const w = fakeWorker(null, log); // never answers `go` by itself: replies are held
    const engine = createEngine(() => w);
    const a = engine.bestMove(START, levelOf(1));
    const b = engine.bestMove(START, levelOf(2));
    await vi.advanceTimersByTimeAsync(1);
    // Only A's search is on the worker; B has sent nothing yet.
    expect(log.slice(2)).toEqual([
      'setoption name Skill Level value 0',
      `position fen ${START}`,
      'go movetime 100',
    ]);

    w.onmessage?.({ data: 'bestmove e2e4' });
    await expect(a).resolves.toEqual({ from: 'e2', to: 'e4' });
    await vi.advanceTimersByTimeAsync(1);
    // B starts only now, and the next bestmove is B's.
    expect(log.slice(5)).toEqual([
      'setoption name Skill Level value 5',
      `position fen ${START}`,
      'go movetime 200',
    ]);

    w.onmessage?.({ data: 'bestmove d2d4' });
    await expect(b).resolves.toEqual({ from: 'd2', to: 'd4' });
  });

  it('rejects an in-flight search promptly on dispose', async () => {
    const engine = createEngine(() => fakeWorker(null));
    const result = engine.bestMove(START, levelOf(5)).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1);
    engine.dispose();
    const error = await result;
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).reason).toBe('disposed');
  });

  it('restarts after a worker error and succeeds when the second worker answers', async () => {
    let n = 0;
    const engine = createEngine(() => {
      const w = fakeWorker(n++ === 0 ? null : 'bestmove g1f3');
      if (n === 1) {
        const base = w.postMessage.bind(w);
        w.postMessage = (msg) => {
          if (msg === 'uci') queueMicrotask(() => w.onerror?.(new Error('wasm failed')));
          else base(msg);
        };
      }
      return w;
    });
    await expect(engine.bestMove(START, levelOf(1))).resolves.toEqual({ from: 'g1', to: 'f3' });
    expect(n).toBe(2);
  });

  it('resolves null for bestmove (none)', async () => {
    const engine = createEngine(() => fakeWorker('bestmove (none)'));
    await expect(engine.bestMove(START, levelOf(1))).resolves.toBeNull();
  });

  it('gives up on the retry’s worker too: its late reply cannot answer the next call', async () => {
    const spawned: WorkerLike[] = [];
    const engine = createEngine(() => {
      const w = fakeWorker(null); // never answers `go` by itself
      spawned.push(w);
      return w;
    });
    const first = engine.bestMove(START, levelOf(1)).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await first).toMatchObject({ reason: 'timeout' });
    expect(spawned).toHaveLength(2);
    expect(spawned[1].terminate).toHaveBeenCalled();

    // The next call starts a worker of its own, and the abandoned search's bestmove, arriving
    // late, answers nothing: the next call gets its own worker's move.
    const next = track(engine.bestMove(START, levelOf(1)));
    await vi.advanceTimersByTimeAsync(1);
    expect(spawned).toHaveLength(3);
    spawned[1].onmessage?.({ data: 'bestmove a2a3' });
    await vi.advanceTimersByTimeAsync(1);
    expect(next.done).toBe(false);
    spawned[2].onmessage?.({ data: 'bestmove g1f3' });
    await vi.advanceTimersByTimeAsync(1);
    expect(next).toMatchObject({ done: true, value: { from: 'g1', to: 'f3' } });
  });
});

describe('createEngine with a worker that arrives late (a slow first download)', () => {
  it('starts the handshake clock only once the worker has loaded', async () => {
    const log: string[] = [];
    let spawned = 0;
    const engine = createEngine(() => {
      spawned++;
      return lateWorker(15_000, 'bestmove e2e4', log);
    });
    const move = track(engine.bestMove(START, levelOf(1)));
    // Longer than the 10 s handshake budget: the download is not the handshake.
    await vi.advanceTimersByTimeAsync(14_999);
    expect(move.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(move).toMatchObject({ done: true, value: { from: 'e2', to: 'e4' } });
    expect(spawned).toBe(1);
    expect(log.slice(0, 2)).toEqual(['uci', 'isready']);
  });

  it('still times out a worker that loads but never answers the handshake', async () => {
    const engine = createEngine(() => {
      const w = lateWorker(15_000, null);
      w.postMessage = () => undefined; // deaf
      return w;
    });
    const result = track(engine.bestMove(START, levelOf(1)));
    await vi.advanceTimersByTimeAsync(15_000 + 9_999);
    expect(result.done).toBe(false);
    // The retry's worker downloads and is deaf too.
    await vi.advanceTimersByTimeAsync(1 + 25_000);
    expect(result).toMatchObject({ done: true, error: { reason: 'timeout' } });
  });

  it('retries a worker that cannot load once, then fails as crashed', async () => {
    const spawned: WorkerLike[] = [];
    const engine = createEngine(() => {
      const w = fakeWorker('bestmove e2e4');
      w.loaded = Promise.reject(new Error('stockfish.wasm stalled'));
      spawned.push(w);
      return w;
    });
    await expect(engine.bestMove(START, levelOf(1))).rejects.toMatchObject({ reason: 'crashed' });
    expect(spawned).toHaveLength(2);
    expect(spawned[1].terminate).toHaveBeenCalled();
  });

  it('ends the wait for a loading worker at once on dispose', async () => {
    const engine = createEngine(() => lateWorker(60_000, 'bestmove e2e4'));
    const result = track(engine.bestMove(START, levelOf(1)));
    await vi.advanceTimersByTimeAsync(1);
    engine.dispose();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toMatchObject({ done: true, error: { reason: 'disposed' } });
  });
});

describe('Engine.warmUp', () => {
  it('starts the worker and its handshake ahead of the first move, which reuses them', async () => {
    const log: string[] = [];
    let spawned = 0;
    const engine = createEngine(() => {
      spawned++;
      return fakeWorker('bestmove e2e4', log);
    });
    await engine.warmUp();
    expect(log).toEqual(['uci', 'isready']);
    await expect(engine.bestMove(START, levelOf(1))).resolves.toEqual({ from: 'e2', to: 'e4' });
    expect(spawned).toBe(1);
    expect(log.slice(2)).toEqual([
      'setoption name Skill Level value 0',
      `position fen ${START}`,
      'go movetime 100',
    ]);
  });

  it('lets a move asked during a slow warm-up wait for the same worker', async () => {
    let spawned = 0;
    const engine = createEngine(() => {
      spawned++;
      return lateWorker(15_000, 'bestmove e7e5');
    });
    void engine.warmUp();
    // The player moves 5 s in, while Stockfish is still downloading.
    await vi.advanceTimersByTimeAsync(5_000);
    const reply = track(engine.bestMove(START, levelOf(1)));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(reply).toMatchObject({ done: true, value: { from: 'e7', to: 'e5' } });
    expect(spawned).toBe(1);
  });

  it('leaves nothing running when it fails: the first move starts afresh', async () => {
    const spawned: WorkerLike[] = [];
    const engine = createEngine(() => {
      const w = fakeWorker('bestmove e2e4');
      if (spawned.length === 0) w.loaded = Promise.reject(new Error('offline'));
      spawned.push(w);
      return w;
    });
    await expect(engine.warmUp()).rejects.toMatchObject({ reason: 'crashed' });
    expect(spawned[0].terminate).toHaveBeenCalled();
    await expect(engine.bestMove(START, levelOf(1))).resolves.toEqual({ from: 'e2', to: 'e4' });
    expect(spawned).toHaveLength(2);
  });

  it('rejects after dispose', async () => {
    const engine = createEngine(() => fakeWorker('bestmove e2e4'));
    engine.dispose();
    await expect(engine.warmUp()).rejects.toMatchObject({ reason: 'disposed' });
  });
});
