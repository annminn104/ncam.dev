import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { download } from './download';

const WASM = 'https://chess.example/stockfish/stockfish.wasm';
const opts = { type: 'application/wasm', stallMs: 20_000 };

/**
 * A server behind `fetch`: it answers after `ttfb` ms (never, for Infinity), then sends each chunk
 * `at` ms after answering, and ends after the last unless `end` is false. Aborting the request's
 * signal fails it, before or during the body, as a browser does.
 */
function server({
  status = 200,
  ttfb = 0,
  chunks = [] as { at: number; bytes: number }[],
  end = true,
} = {}) {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const signal = init?.signal ?? undefined;
        const reason = () => signal?.reason ?? new DOMException('aborted', 'AbortError');
        const onAbort = () => reject(reason());
        signal?.addEventListener('abort', onAbort, { once: true });
        if (ttfb === Infinity) return;
        setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          if (signal?.aborted) return reject(reason());
          let closed = false;
          const body = new ReadableStream<Uint8Array>({
            start(controller) {
              signal?.addEventListener('abort', () => {
                if (closed) return;
                closed = true;
                controller.error(reason());
              });
              for (const c of chunks) {
                setTimeout(() => closed || controller.enqueue(new Uint8Array(c.bytes)), c.at);
              }
              if (!end) return;
              setTimeout(
                () => {
                  if (closed) return;
                  closed = true;
                  controller.close();
                },
                Math.max(0, ...chunks.map((c) => c.at)),
              );
            },
            cancel() {
              closed = true;
            },
          });
          resolve(new Response(body, { status }));
        }, ttfb);
      }),
  );
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
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('download', () => {
  it('keeps a slow download that keeps arriving, however long it takes', async () => {
    // 15 s to answer, then 1 MB every 15 s: a minute and a quarter, never 20 s without bytes.
    const at = [15_000, 30_000, 45_000, 60_000];
    vi.stubGlobal(
      'fetch',
      server({ ttfb: 15_000, chunks: at.map((t) => ({ at: t, bytes: 1 << 20 })) }),
    );
    const result = track(download(WASM, opts));
    await vi.advanceTimersByTimeAsync(74_999);
    expect(result.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(result.done).toBe(true);
    const blob = result.value as Blob;
    expect(blob.size).toBe(4 << 20);
    expect(blob.type).toBe('application/wasm');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fails a download that stops arriving', async () => {
    vi.stubGlobal('fetch', server({ chunks: [{ at: 1_000, bytes: 1024 }], end: false }));
    const result = track(download(WASM, opts));
    await vi.advanceTimersByTimeAsync(1_000 + 19_999);
    expect(result.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(result.done).toBe(true);
    expect(String(result.error)).toMatch(/stalled/);
  });

  it('fails a server that never answers', async () => {
    vi.stubGlobal('fetch', server({ ttfb: Infinity }));
    const result = track(download(WASM, opts));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(result.done).toBe(true);
    expect(String(result.error)).toMatch(/stalled/);
  });

  it('fails on an HTTP error', async () => {
    vi.stubGlobal('fetch', server({ status: 404 }));
    const result = track(download(WASM, opts));
    await vi.advanceTimersByTimeAsync(0);
    expect(result.done).toBe(true);
    expect(String(result.error)).toMatch(/404/);
    // The server's own last timer runs a tick later; no stall timer of download's is left.
    await vi.advanceTimersByTimeAsync(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops when the caller aborts', async () => {
    vi.stubGlobal('fetch', server({ chunks: [{ at: 60_000, bytes: 1 }] }));
    const caller = new AbortController();
    const result = track(download(WASM, { ...opts, signal: caller.signal }));
    await vi.advanceTimersByTimeAsync(5_000);
    caller.abort(new Error('battle over'));
    await vi.advanceTimersByTimeAsync(0);
    expect(result.done).toBe(true);
    expect(String(result.error)).toMatch(/battle over/);
  });
});
