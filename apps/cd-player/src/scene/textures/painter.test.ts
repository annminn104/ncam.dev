import { describe, expect, it } from 'vitest';
import type { TrackView } from '../../bridge';
import { createPainter, printKey, reprintFor } from './painter';

const track = (id: string, art: string | null = null, photo: string | null = null): TrackView => ({
  id,
  title: id,
  artists: 'A',
  artUrl: art,
  artistUrl: photo,
  palette: null,
});

/** Lets every pending promise callback run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A painter whose loads finish when the test says; `drawn` lists what it drew, in order. */
function harness() {
  const loads: { id: string; finish(): void; fail(error: Error): void }[] = [];
  const drawn: [index: 0 | 1, id: string, loaded: string][] = [];
  const paint = createPainter(
    (view) =>
      new Promise<string>((resolve, reject) => {
        loads.push({
          id: view.id,
          finish: () => resolve(`print of ${view.id}`),
          fail: reject,
        });
      }),
    (index, loaded, view) => drawn.push([index, view.id, loaded]),
  );
  return { paint, loads, drawn };
}

describe('createPainter', () => {
  it('draws what the print loaded, once it has', async () => {
    const h = harness();
    const done = h.paint(0, track('a'));
    await flush();
    expect(h.drawn).toEqual([]);
    h.loads[0].finish();
    await done;
    expect(h.drawn).toEqual([[0, 'a', 'print of a']]);
  });

  it.each([
    ['the newer finishes first', [1, 0]],
    ['the older finishes first', [0, 1]],
  ])('lets only the last print of a disc draw when %s', async (_name, finishing) => {
    const h = harness();
    // The hook's own print for the lid, then the track a visitor picked: no signal on either.
    const older = h.paint(0, track('first'));
    const newer = h.paint(0, track('picked'));
    for (const load of finishing) h.loads[load].finish();
    await Promise.all([older, newer]);
    expect(h.drawn).toEqual([[0, 'picked', 'print of picked']]);
  });

  it('keeps the discs apart', async () => {
    const h = harness();
    const first = h.paint(0, track('a'));
    const second = h.paint(1, track('b'));
    h.loads[1].finish();
    h.loads[0].finish();
    await Promise.all([first, second]);
    expect(h.drawn).toEqual([
      [1, 'b', 'print of b'],
      [0, 'a', 'print of a'],
    ]);
  });

  it('draws nothing once the director aborted the print', async () => {
    const h = harness();
    const director = new AbortController();
    const aborted = h.paint(0, track('a'), director.signal);
    const kept = h.paint(1, track('b'), new AbortController().signal);
    director.abort();
    h.loads[0].finish();
    h.loads[1].finish();
    await Promise.all([aborted, kept]);
    expect(h.drawn).toEqual([[1, 'b', 'print of b']]);
  });

  it('reports a failed load and draws nothing, leaving a later print to draw', async () => {
    const h = harness();
    const failing = h.paint(0, track('a'));
    h.loads[0].fail(new Error('no art'));
    await expect(failing).rejects.toThrow('no art');
    const next = h.paint(0, track('b'));
    h.loads[1].finish();
    await next;
    expect(h.drawn).toEqual([[0, 'b', 'print of b']]);
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
