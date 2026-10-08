import type { MoveInput } from '../game/game';
import type { Level } from './levels';
import { parseBestMove } from './uci';

export interface WorkerLike {
  postMessage(msg: string): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  terminate(): void;
  onerror?: ((e: unknown) => void) | null;
  /**
   * For a worker that is still on its way (`lazyWorker`: Stockfish downloads first). It settles
   * once the worker can take commands, and the handshake's clock starts then, so a slow download
   * doesn't count as a dead engine. It rejects if the worker will never come.
   */
  loaded?: Promise<unknown>;
}

export class EngineError extends Error {
  constructor(readonly reason: 'timeout' | 'crashed' | 'disposed') {
    super(`stockfish ${reason}`);
    this.name = 'EngineError';
  }
}

export interface Engine {
  bestMove(fen: string, level: Level): Promise<MoveInput | null>;
  /**
   * Start the worker and its handshake now, ahead of the first move: a battle vs the AI calls this
   * as it opens, so the download overlaps the player's first move. A failure leaves nothing
   * running, and the next `bestMove` starts afresh.
   */
  warmUp(): Promise<void>;
  dispose(): void;
}

type Waiter = {
  /** The line that ends the wait. A wait for a worker to load has none. */
  test?: (line: string) => boolean;
  resolve: (line: string) => void;
  reject: (reason: EngineError['reason']) => void;
};

/**
 * A UCI client over one Stockfish worker. A search that outlives 5 × movetime (+ 2 s) restarts
 * the worker and asks once more before failing with 'timeout'. A call that fails stops its
 * worker, so the next call starts a fresh one.
 */
export function createEngine(
  spawn: () => WorkerLike,
  { handshakeMs = 10_000 }: { handshakeMs?: number } = {},
): Engine {
  let worker: WorkerLike | null = null;
  let ready: Promise<void> | null = null;
  let waiters: Waiter[] = [];
  let disposed = false;

  const start = () => {
    const w = spawn();
    w.onmessage = (e) => {
      // A stopped worker answers nothing: a search given up on can still reply late.
      if (worker !== w) return;
      const lines = String(e.data).split('\n');
      for (const line of lines) {
        const hit = waiters.find((x) => x.test?.(line));
        if (hit) {
          waiters = waiters.filter((x) => x !== hit);
          hit.resolve(line);
        }
      }
    };
    w.onerror = () => {
      if (worker !== w) return;
      if (waiters.length === 0) stop();
      else settleAll('crashed');
    };
    worker = w;
    const handshake = (async () => {
      if (w.loaded) await loading(w.loaded);
      await send('uci', (l) => l === 'uciok', handshakeMs);
      await send('isready', (l) => l === 'readyok', handshakeMs);
    })();
    ready = handshake;
    // A failed handshake leaves nothing running, whoever was waiting for it (a warm-up, a move).
    handshake.catch(() => {
      if (worker === w) stop();
    });
  };

  /** Reject every pending wait (clearing its timer). */
  const settleAll = (reason: EngineError['reason']) => {
    const pending = waiters;
    waiters = [];
    for (const x of pending) x.reject(reason);
  };

  const stop = (reason: EngineError['reason'] = 'crashed') => {
    settleAll(reason);
    worker?.terminate();
    worker = null;
    ready = null;
  };

  /** Wait for a worker on its way. There is no clock: stop() and dispose() end it like any wait. */
  function loading(loaded: Promise<unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        resolve: () => resolve(),
        reject: (reason) => reject(new EngineError(reason)),
      };
      waiters.push(waiter);
      const end = (settle: () => void) => () => {
        if (!waiters.includes(waiter)) return; // already ended by stop()
        waiters = waiters.filter((x) => x !== waiter);
        settle();
      };
      loaded.then(
        end(() => waiter.resolve('')),
        end(() => waiter.reject('crashed')),
      );
    });
  }

  function send(msg: string, until: (line: string) => boolean, ms: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters = waiters.filter((x) => x !== waiter);
        reject(new EngineError('timeout'));
      }, ms);
      const waiter: Waiter = {
        test: until,
        resolve: (line) => {
          clearTimeout(timer);
          resolve(line);
        },
        reject: (reason) => {
          clearTimeout(timer);
          reject(new EngineError(reason));
        },
      };
      waiters.push(waiter);
      worker?.postMessage(msg);
    });
  }

  async function ask(fen: string, level: Level): Promise<MoveInput | null> {
    if (!worker) start();
    await ready;
    worker!.postMessage(`setoption name Skill Level value ${level.skill}`);
    worker!.postMessage(`position fen ${fen}`);
    const line = await send(
      `go movetime ${level.movetime}`,
      (l) => parseBestMove(l) !== undefined,
      level.movetime * 5 + 2000,
    );
    return parseBestMove(line) ?? null;
  }

  async function attempt(fen: string, level: Level): Promise<MoveInput | null> {
    if (disposed) throw new EngineError('disposed');
    try {
      return await ask(fen, level);
    } catch {
      if (disposed) throw new EngineError('disposed');
      stop();
    }
    try {
      return await ask(fen, level);
    } catch (error) {
      if (disposed) throw new EngineError('disposed');
      // This worker may still be searching: its bestmove must not answer the next call.
      stop();
      throw error instanceof EngineError ? error : new EngineError('crashed');
    }
  }

  // One search at a time: a second call would interleave setoption/position.
  let chain: Promise<unknown> = Promise.resolve();

  return {
    bestMove(fen, level) {
      const run = chain.then(() => attempt(fen, level));
      chain = run.catch(() => undefined);
      return run;
    },
    async warmUp() {
      if (disposed) throw new EngineError('disposed');
      if (!worker) start();
      await ready;
    },
    dispose() {
      disposed = true;
      stop('disposed');
    },
  };
}
