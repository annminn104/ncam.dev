import { describe, expect, it, vi } from 'vitest';
import { downloadFraction, downloadModel } from './model';

const URL_ = 'https://cd-player.example/assets/cd-player.glb';
const CHUNKS = [
  new Uint8Array([1, 2, 3, 4]),
  new Uint8Array([5, 6, 7, 8]),
  new Uint8Array([9, 10, 11, 12]),
];

/** The model's answer, three chunks of four bytes, with its length or without (chunked). */
const answer = (length: string | null = '12') =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of CHUNKS) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { headers: length === null ? {} : { 'Content-Length': length } },
  );

describe('downloadModel', () => {
  it('fetches the GLB, a fraction per chunk when the response names its length', async () => {
    const seen: (number | null)[] = [];
    const bytes = await downloadModel(
      URL_,
      (fraction) => seen.push(fraction),
      undefined,
      () => Promise.resolve(answer()),
    );
    expect([...new Uint8Array(bytes)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(seen).toEqual([4 / 12, 8 / 12, 1]);
  });

  it('reports each chunk with no fraction when the response names no length', async () => {
    const seen: (number | null)[] = [];
    await downloadModel(
      URL_,
      (fraction) => seen.push(fraction),
      undefined,
      () => Promise.resolve(answer(null)),
    );
    expect(seen).toEqual([null, null, null]);
  });

  it('asks for every load anew with its own signal: a load never waits on another one', async () => {
    // three's FileLoader joins a load to a request for the same URL still in flight, so a retry
    // after a stall waited on the request that had stalled.
    const fetchModel = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(answer()),
    );
    const first = new AbortController();
    const second = new AbortController();
    await Promise.all([
      downloadModel(URL_, undefined, first.signal, fetchModel),
      downloadModel(URL_, undefined, second.signal, fetchModel),
    ]);
    expect(fetchModel.mock.calls.map(([url, init]) => [url, init?.signal])).toEqual([
      [URL_, first.signal],
      [URL_, second.signal],
    ]);
  });

  it('stops where its signal aborts it, and fails on an answer that is not the model', async () => {
    const download = new AbortController();
    const seen: (number | null)[] = [];
    // As a browser's fetch does: the body errors once the request's signal aborts.
    const stalls = (_url: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(CHUNKS[0]);
              init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason));
            },
          }),
          { headers: { 'Content-Length': '12' } },
        ),
      );
    const pending = downloadModel(
      URL_,
      (fraction) => {
        seen.push(fraction);
        download.abort();
      },
      download.signal,
      stalls,
    );
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(seen).toEqual([4 / 12]);
    await expect(
      downloadModel(URL_, undefined, undefined, () =>
        Promise.resolve(new Response('Not Found', { status: 404 })),
      ),
    ).rejects.toThrow(/404/);
  });
});

describe('downloadFraction', () => {
  it('reads how much of a GLB of known size has come', () => {
    expect(downloadFraction({ lengthComputable: true, loaded: 0, total: 589_824 })).toBe(0);
    expect(downloadFraction({ lengthComputable: true, loaded: 147_456, total: 589_824 })).toBe(
      0.25,
    );
    expect(downloadFraction({ lengthComputable: true, loaded: 589_824, total: 589_824 })).toBe(1);
  });

  it('has no fraction when the response names no length', () => {
    expect(downloadFraction({ lengthComputable: false, loaded: 65_536, total: 0 })).toBeNull();
    expect(downloadFraction({ lengthComputable: true, loaded: 65_536, total: 0 })).toBeNull();
  });

  it('holds a compressed transfer, whose decoded bytes outrun the length it named, at 1', () => {
    expect(downloadFraction({ lengthComputable: true, loaded: 900_000, total: 589_824 })).toBe(1);
  });
});
