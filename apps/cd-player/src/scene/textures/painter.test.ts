import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrackView } from '../../bridge';
import { createPainter, printKey, reprintFor, settlesWithin } from './painter';

afterEach(() => {
  vi.useRealTimers();
});

const track = (id: string, art: string | null = null, photo: string | null = null): TrackView => ({
  id,
  title: id,
  artists: 'A',
  artUrl: art,
  artistUrl: photo,
});

/** Lets every pending promise callback run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A painter whose loads finish when the test says; `drawn` lists what it drew, in order. */
function harness() {
  const loads: { id: string; finish(): void; fail(error: Error): void }[] = [];
  const drawn: [index: number, id: string, loaded: string, size: number][] = [];
  const paint = createPainter(
    (view) =>
      new Promise<string>((resolve, reject) => {
        loads.push({
          id: view.id,
          finish: () => resolve(`print of ${view.id}`),
          fail: reject,
        });
      }),
    (index, loaded, view, size) => drawn.push([index, view.id, loaded, size]),
  );
  return { paint, loads, drawn };
}

describe('createPainter', () => {
  it('draws what the print loaded, once it has, at the size asked for', async () => {
    const h = harness();
    const done = h.paint(0, track('a'), 1024);
    await flush();
    expect(h.drawn).toEqual([]);
    h.loads[0].finish();
    await done;
    expect(h.drawn).toEqual([[0, 'a', 'print of a', 1024]]);
  });

  it.each([
    ['the newer finishes first', [1, 0]],
    ['the older finishes first', [0, 1]],
  ])('lets only the last print of a surface draw when %s', async (_name, finishing) => {
    const h = harness();
    // The director's print of a copy, then the hook's own as its art arrives: no signal on either.
    const older = h.paint(0, track('first'), 512);
    const newer = h.paint(0, track('picked'), 1024);
    for (const load of finishing) h.loads[load].finish();
    await Promise.all([older, newer]);
    expect(h.drawn).toEqual([[0, 'picked', 'print of picked', 1024]]);
  });

  it('keeps every surface apart, the seven copies’ and the booklet’s', async () => {
    const h = harness();
    const prints = [
      h.paint(6, track('g'), 512),
      h.paint(3, track('d'), 512),
      h.paint(0, track('a'), 1024),
    ];
    h.loads[2].finish();
    h.loads[0].finish();
    h.loads[1].finish();
    await Promise.all(prints);
    expect(h.drawn).toEqual([
      [0, 'a', 'print of a', 1024],
      [6, 'g', 'print of g', 512],
      [3, 'd', 'print of d', 512],
    ]);
  });

  it('draws nothing once the director aborted the print', async () => {
    const h = harness();
    const director = new AbortController();
    const aborted = h.paint(0, track('a'), 512, director.signal);
    const kept = h.paint(1, track('b'), 512, new AbortController().signal);
    director.abort();
    h.loads[0].finish();
    h.loads[1].finish();
    await Promise.all([aborted, kept]);
    expect(h.drawn).toEqual([[1, 'b', 'print of b', 512]]);
  });

  it('reports a failed load and draws nothing, leaving a later print to draw', async () => {
    const h = harness();
    const failing = h.paint(0, track('a'), 512);
    h.loads[0].fail(new Error('no art'));
    await expect(failing).rejects.toThrow('no art');
    const next = h.paint(0, track('b'), 512);
    h.loads[1].finish();
    await next;
    expect(h.drawn).toEqual([[0, 'b', 'print of b', 512]]);
  });
});

describe('reprintFor', () => {
  // A track picked from beyond the few the engine has fetched details of: no art when its change
  // begins, the art once the details arrive.
  const bare = track('picked');
  const known = track('picked', 'art', 'photo');

  it('hands back the same track once its art is known', () => {
    expect(reprintFor(bare, { current: known, upcoming: [] })).toBe(known);
  });

  it('follows the art in two steps: the album art first, the artist photo after', () => {
    const album = track('picked', 'art', 'art');
    expect(reprintFor(bare, { current: album, upcoming: [] })).toBe(album);
    expect(reprintFor(album, { current: known, upcoming: [] })).toBe(known);
  });

  it('finds the track among the upcoming ones too', () => {
    expect(reprintFor(bare, { current: null, upcoming: [track('x'), known] })).toBe(known);
  });

  it('leaves a print that is up to date, or that holds no track, alone', () => {
    expect(
      reprintFor(known, { current: track('picked', 'art', 'photo'), upcoming: [] }),
    ).toBeNull();
    expect(reprintFor(null, { current: known, upcoming: [] })).toBeNull();
  });

  it('never puts another track on the disc', () => {
    expect(reprintFor(bare, { current: track('other', 'art', 'photo'), upcoming: [] })).toBeNull();
    expect(reprintFor(bare, { current: null, upcoming: [] })).toBeNull();
  });

  it('keys a print by the track and its pictures', () => {
    expect(printKey(known)).not.toBe(printKey(bare));
    expect(printKey(known)).toBe(printKey(track('picked', 'art', 'photo')));
  });
});

describe('settlesWithin', () => {
  it('says true as the work settles in time, and stops waiting', async () => {
    vi.useFakeTimers();
    await expect(settlesWithin(Promise.resolve(), 1000)).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('counts failed work as settled too: the wait is for it to be over, not for it to work', async () => {
    vi.useFakeTimers();
    const failed = Promise.reject(new Error('offline'));
    await expect(settlesWithin(failed, 1000)).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('says false once the wait runs out, and the work goes on without error', async () => {
    vi.useFakeTimers();
    let finish = () => {};
    const work = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let answer: boolean | null = null;
    void settlesWithin(work, 1000).then((settled) => {
      answer = settled;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(answer).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(answer).toBe(false);
    // The work finishing afterwards changes nothing.
    finish();
    await vi.advanceTimersByTimeAsync(10);
    expect(answer).toBe(false);
  });
});
