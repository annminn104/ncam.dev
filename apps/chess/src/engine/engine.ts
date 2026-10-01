import type { MoveInput } from '../game/game';
import type { Level } from './levels';
import { parseBestMove } from './uci';

export interface WorkerLike {
  postMessage(msg: string): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  terminate(): void;
  onerror?: ((e: unknown) => void) | null;
}

export class EngineError extends Error {
  constructor(readonly reason: 'timeout' | 'crashed' | 'disposed') {
    super(`stockfish ${reason}`);
    this.name = 'EngineError';
  }
}

export interface Engine {
  bestMove(fen: string, level: Level): Promise<MoveInput | null>;
  dispose(): void;
}

type Waiter = {
  test: (line: string) => boolean;
  resolve: (line: string) => void;
  reject: (reason: EngineError['reason']) => void;
};

/**
 * A UCI client over one Stockfish worker. A search that outlives 5 × movetime
 * (+ 2 s) restarts the worker and asks once more before failing with 'timeout'.
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
      const lines = String(e.data).split('\n');
      for (const line of lines) {
        const hit = waiters.find((x) => x.test(line));
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
    ready = (async () => {
      await send('uci', (l) => l === 'uciok', handshakeMs);
      await send('isready', (l) => l === 'readyok', handshakeMs);
    })();
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
    } catch (error) {
      if (disposed) throw new EngineError('disposed');
      if (!(error instanceof EngineError)) throw new EngineError('crashed');
      stop();
      return await ask(fen, level);
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
    dispose() {
      disposed = true;
      stop('disposed');
    },
  };
}
