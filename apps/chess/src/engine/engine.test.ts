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
});
