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
});
