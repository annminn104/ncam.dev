import { describe, expect, it, vi } from 'vitest';
import { Group, Object3D } from 'three';
import {
  CD_NODES,
  DYNAMIC_MATERIALS,
  REQUIRED_NODES,
  TURNTABLE_MATERIALS,
  TURNTABLE_NODES,
} from './contract';
import { downloadFraction, downloadModel, readContract } from './model';

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
  it('fetches the GLB: the request, each chunk of known length, 1 at the end', async () => {
    const seen: (number | null)[] = [];
    const bytes = await downloadModel(
      URL_,
      (fraction) => seen.push(fraction),
      undefined,
      () => Promise.resolve(answer()),
    );
    expect([...new Uint8Array(bytes)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // The last chunk brings every byte the length named, and still only the end is the whole.
    expect(seen).toEqual([null, 4 / 12, 8 / 12, 0.99, 1]);
  });

  it('reports no fraction without a length, then its end', async () => {
    const seen: (number | null)[] = [];
    await downloadModel(
      URL_,
      (fraction) => seen.push(fraction),
      undefined,
      () => Promise.resolve(answer(null)),
    );
    expect(seen).toEqual([null, null, null, null, 1]);
  });

  it('reports its request as it goes out, before any answer comes', async () => {
    const seen: (number | null)[] = [];
    // An answer that never comes: the boot must still know the download has begun.
    void downloadModel(
      URL_,
      (fraction) => seen.push(fraction),
      undefined,
      () => new Promise<Response>(() => {}),
    );
    await Promise.resolve();
    expect(seen).toEqual([null]);
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

  it('stops where its signal aborts it, with no end; fails on a 404', async () => {
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
        // The first chunk is in: the boot lets go of the load.
        if (fraction !== null) download.abort();
      },
      download.signal,
      stalls,
    );
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    // Its request and its one chunk, never an end.
    expect(seen).toEqual([null, 4 / 12]);
    await expect(
      downloadModel(URL_, undefined, undefined, () =>
        Promise.resolve(new Response('Not Found', { status: 404 })),
      ),
    ).rejects.toThrow('cd-player.glb answered 404');
    // The Clear's own file is named, not the suitcase's.
    await expect(
      downloadModel(
        'https://cd-player.example/assets/cd-player-clear.glb?v=2',
        undefined,
        undefined,
        () => Promise.resolve(new Response('Not Found', { status: 404 })),
      ),
    ).rejects.toThrow('cd-player-clear.glb answered 404');
  });
});

describe('downloadFraction', () => {
  it('reads how much of a GLB of known size has come', () => {
    expect(downloadFraction({ lengthComputable: true, loaded: 0, total: 589_824 })).toBe(0);
    expect(downloadFraction({ lengthComputable: true, loaded: 147_456, total: 589_824 })).toBe(
      0.25,
    );
    // Every byte the length named is no proof of the end: that is the stream's to say.
    expect(downloadFraction({ lengthComputable: true, loaded: 589_824, total: 589_824 })).toBe(
      0.99,
    );
  });

  it('has no fraction when the response names no length', () => {
    expect(downloadFraction({ lengthComputable: false, loaded: 65_536, total: 0 })).toBeNull();
    expect(downloadFraction({ lengthComputable: true, loaded: 65_536, total: 0 })).toBeNull();
  });

  it('holds a compressed transfer, whose decoded bytes outrun the length it named, at 99 %', () => {
    expect(downloadFraction({ lengthComputable: true, loaded: 900_000, total: 589_824 })).toBe(
      0.99,
    );
  });
});

/** A root holding an empty for each name. */
function rootWith(names: readonly string[]): Group {
  const root = new Group();
  for (const name of names) {
    const node = new Object3D();
    node.name = name;
    root.add(node);
  }
  return root;
}
const slotsFor = (names: readonly string[]) => Object.fromEntries(names.map((name) => [name, {}]));

describe('readContract', () => {
  it('takes every node and print a CD player needs, and the optional nodes it has', () => {
    const root = rootWith([...REQUIRED_NODES, 'door_hinge']);
    const { nodes, missing } = readContract(root, slotsFor(DYNAMIC_MATERIALS), 'cd');
    expect(missing).toEqual([]);
    for (const name of [...REQUIRED_NODES, 'door_hinge'])
      expect(nodes[name]?.name, name).toBe(name);
    expect(nodes.jog_ring).toBeUndefined();
  });

  it('names each missing node, then each missing print', () => {
    const root = rootWith(REQUIRED_NODES.filter((name) => name !== 'knob' && name !== 'tag'));
    const slots = slotsFor(DYNAMIC_MATERIALS.filter((name) => name !== 'lcd_screen'));
    expect(readContract(root, slots, 'cd').missing).toEqual(['knob', 'tag', 'lcd_screen']);
  });

  it('holds a turntable to its own list, and a CD player to its own', () => {
    const turntable = rootWith(TURNTABLE_NODES);
    expect(readContract(turntable, slotsFor(TURNTABLE_MATERIALS), 'vinyl').missing).toEqual([]);
    expect(readContract(turntable, slotsFor(['art_disc', 'card_print']), 'vinyl').missing).toEqual([
      'art_sleeve',
    ]);
    expect(
      readContract(rootWith(REQUIRED_NODES), slotsFor(DYNAMIC_MATERIALS), 'vinyl').missing,
    ).toEqual(['platter', 'arm_head', 'sleeve', 'sleeve_seat', 'art_sleeve']);
    expect(readContract(turntable, slotsFor(TURNTABLE_MATERIALS), 'cd').missing).toEqual([
      ...CD_NODES,
      'art_booklet',
      'tag_print',
      'lcd_screen',
    ]);
  });
});
