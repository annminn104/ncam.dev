import { describe, expect, it, vi } from 'vitest';
import { EMPTY_VIEW, type SceneView, type TrackView } from '../bridge';
import { DURATION, type SwapKind } from './director';
import type { ChangeState } from './rig';
import {
  createSwapController,
  PRINT_WAIT_MS,
  REDUCED_MOTION_MS,
  type SwapClock,
} from './swap-controller';

const track = (id: string): TrackView => ({
  id,
  title: id,
  artists: 'A',
  artUrl: null,
  artistUrl: null,
  palette: null,
});

const view = (patch: Partial<SceneView>): SceneView => ({ ...EMPTY_VIEW, ...patch });

/** Lets every pending promise callback run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A controller on a fake clock whose prints land (or fail) when the test says. */
function harness(options: { reduced?: boolean; rig?: ChangeState } = {}) {
  const rig: ChangeState = options.rig ?? { lidCase: 0, seated: null, swapping: false };
  let now = 0;
  let timers: { at: number; done(): void }[] = [];
  const clock: SwapClock = {
    now: () => now,
    after: (ms, done) => {
      const timer = { at: now + ms, done };
      timers.push(timer);
      return () => {
        timers = timers.filter((other) => other !== timer);
      };
    },
  };
  const prints: {
    index: 0 | 1;
    id: string;
    signal: AbortSignal | undefined;
    land(): void;
    fail(error: Error): void;
  }[] = [];
  const failed = vi.fn();
  const controller = createSwapController({
    rig,
    reduced: options.reduced ?? false,
    clock,
    onPrintFailed: failed,
    paint: (index, view, signal) =>
      new Promise<void>((resolve, reject) => {
        prints.push({ index, id: view.id, signal, land: resolve, fail: reject });
      }),
  });
  /** Each pose drawn: the change's kind, the ms into it, and the lid's case as it was drawn. */
  const poses: [SwapKind, number, 0 | 1][] = [];
  return {
    rig,
    controller,
    prints,
    failed,
    poses,
    /** Draws a frame at `ms`; true when it posed a change. */
    frame(ms: number): boolean {
      now = ms;
      return controller.frame((kind, t) => poses.push([kind, t, rig.lidCase]));
    },
    /** Moves the clock to `ms`, running the timers due. */
    advance(ms: number): void {
      now = ms;
      const due = timers.filter((timer) => timer.at <= ms);
      timers = timers.filter((timer) => timer.at > ms);
      for (const timer of due) timer.done();
    },
    /** Asks for a change; `settled` turns true once its promise does. */
    swap(id: string): { settled: boolean } {
      const state = { settled: false };
      void controller.swap(track(id)).then(() => {
        state.settled = true;
      });
      return state;
    },
  };
}

describe('createSwapController', () => {
  it('inserts the first disc: prints it in the lid, holds the first pose meanwhile, then seats it', async () => {
    const h = harness();
    const change = h.swap('a');
    expect(h.rig.swapping).toBe(true);
    expect(h.prints.map(({ index, id }) => [index, id])).toEqual([[0, 'a']]);
    expect(h.frame(100)).toBe(true);
    expect(h.poses.at(-1)).toEqual(['insert', 0, 0]);
    h.prints[0].land();
    await flush();
    // The timeline starts as the print returns (the clock read 100 then).
    expect(h.frame(600)).toBe(true);
    expect(h.poses.at(-1)).toEqual(['insert', 500, 0]);
    await flush();
    expect(change.settled).toBe(false);
    expect(h.frame(100 + DURATION.insert)).toBe(true);
    expect(h.poses.at(-1)).toEqual(['insert', DURATION.insert, 0]);
    await flush();
    expect(change.settled).toBe(true);
    expect(h.rig).toEqual({ lidCase: 0, seated: 0, swapping: false });
    expect(h.frame(2000)).toBe(false);
  });

  it('changes discs: prints the spare case, draws the last pose on the old lid, then hands it over', async () => {
    const h = harness({ rig: { lidCase: 0, seated: 0, swapping: false } });
    const change = h.swap('b');
    expect(h.prints[0].index).toBe(1);
    h.prints[0].land();
    await flush();
    h.frame(DURATION.change);
    expect(h.poses.at(-1)).toEqual(['change', DURATION.change, 0]);
    await flush();
    expect(change.settled).toBe(true);
    expect(h.rig).toEqual({ lidCase: 1, seated: 1, swapping: false });
  });

  it('runs the change on the print the disc has when its print fails, and reports it', async () => {
    const h = harness({ rig: { lidCase: 1, seated: 1, swapping: false } });
    const change = h.swap('c');
    const error = new Error('could not load the art');
    h.prints[0].fail(error);
    await flush();
    expect(h.failed).toHaveBeenCalledWith(error, expect.objectContaining({ id: 'c' }));
    expect(h.frame(1000)).toBe(true);
    expect(h.poses.at(-1)).toEqual(['change', 1000, 1]);
    h.frame(DURATION.change);
    await flush();
    expect(change.settled).toBe(true);
    expect(h.rig).toEqual({ lidCase: 0, seated: 0, swapping: false });
  });

  it('runs the change anyway once its print has kept it waiting PRINT_WAIT_MS', async () => {
    const h = harness({ rig: { lidCase: 0, seated: 0, swapping: false } });
    const change = h.swap('b');
    h.advance(PRINT_WAIT_MS - 1);
    expect(h.frame(PRINT_WAIT_MS - 1)).toBe(true);
    expect(h.poses.at(-1)).toEqual(['change', 0, 0]);
    h.advance(PRINT_WAIT_MS);
    h.frame(PRINT_WAIT_MS + 1000);
    expect(h.poses.at(-1)).toEqual(['change', 1000, 0]);
    h.frame(PRINT_WAIT_MS + DURATION.change);
    await flush();
    expect(change.settled).toBe(true);
    expect(h.rig).toEqual({ lidCase: 1, seated: 1, swapping: false });
    // The print was never told to give up: it still lands on its disc whenever it can.
    expect(h.prints[0].signal?.aborted).toBe(false);
  });

  it('never throws a print, for a change or a seat, even from a painter that throws', async () => {
    const error = new Error('no 2D canvas');
    const failed = vi.fn();
    const rig: ChangeState = { lidCase: 0, seated: null, swapping: false };
    const controller = createSwapController({
      rig,
      reduced: false,
      clock: { now: () => 0, after: () => () => {} },
      onPrintFailed: failed,
      paint: () => {
        throw error;
      },
    });
    await expect(controller.print(0, track('a'))).resolves.toBeUndefined();
    const pending = controller.swap(track('b'));
    await flush();
    expect(failed).toHaveBeenCalledTimes(2);
    expect(failed).toHaveBeenLastCalledWith(error, expect.objectContaining({ id: 'b' }));
    expect(controller.frame(() => {})).toBe(true);
    controller.dispose();
    await expect(pending).resolves.toBeUndefined();
    expect(rig).toEqual({ lidCase: 0, seated: 0, swapping: false });
  });

  it('settles a change at once when the scene goes mid-print, and its late print starts nothing', async () => {
    const h = harness();
    const change = h.swap('a');
    h.controller.dispose();
    await flush();
    expect(change.settled).toBe(true);
    expect(h.rig).toEqual({ lidCase: 0, seated: 0, swapping: false });
    h.prints[0].land();
    await flush();
    expect(h.frame(500)).toBe(false);
  });

  it('settles a change at once when the scene goes mid-timeline', async () => {
    const h = harness({ rig: { lidCase: 0, seated: 0, swapping: false } });
    const change = h.swap('b');
    h.prints[0].land();
    await flush();
    h.frame(1000);
    h.controller.dispose();
    await flush();
    expect(change.settled).toBe(true);
    expect(h.rig).toEqual({ lidCase: 1, seated: 1, swapping: false });
    expect(h.frame(1100)).toBe(false);
  });

  it('ends the change still turning before it starts the next (a new collection, then Play)', async () => {
    const h = harness();
    const first = h.swap('a');
    h.prints[0].land();
    await flush();
    h.frame(500);
    const second = h.swap('b');
    await flush();
    expect(first.settled).toBe(true);
    // The insert ended with its disc seated, so the next is a change to the spare case.
    expect(h.rig).toEqual({ lidCase: 0, seated: 0, swapping: true });
    expect(h.prints[1].index).toBe(1);
    h.frame(600);
    expect(h.poses.at(-1)).toEqual(['change', 0, 0]);
    h.prints[1].land();
    await flush();
    h.frame(600 + DURATION.change);
    await flush();
    expect(second.settled).toBe(true);
    expect(h.rig).toEqual({ lidCase: 1, seated: 1, swapping: false });
  });

  it('ends a change still printing when the next arrives, and its late print starts nothing', async () => {
    const h = harness();
    const first = h.swap('a');
    const second = h.swap('b');
    await flush();
    expect(first.settled).toBe(true);
    expect(h.prints.map(({ index }) => index)).toEqual([0, 1]);
    h.prints[0].land();
    await flush();
    h.frame(100);
    expect(h.poses.at(-1)).toEqual(['change', 0, 0]);
    expect(second.settled).toBe(false);
  });

  it('tells a disc’s older print to give up once a newer print of that disc starts', () => {
    const h = harness();
    h.swap('a');
    h.swap('b');
    h.swap('c');
    expect(h.prints.map(({ index, id }) => [index, id])).toEqual([
      [0, 'a'],
      [1, 'b'],
      [0, 'c'],
    ]);
    expect(h.prints.map(({ signal }) => signal?.aborted)).toEqual([true, false, false]);
  });

  it('makes a change instant under reduced motion, and lets the music wait a beat', async () => {
    const h = harness({ reduced: true, rig: { lidCase: 0, seated: 0, swapping: false } });
    const change = h.swap('b');
    h.prints[0].land();
    await flush();
    expect(h.rig).toEqual({ lidCase: 1, seated: 1, swapping: false });
    expect(h.frame(0)).toBe(false);
    h.advance(REDUCED_MOTION_MS - 1);
    await flush();
    expect(change.settled).toBe(false);
    h.advance(REDUCED_MOTION_MS);
    await flush();
    expect(change.settled).toBe(true);
  });

  it('cuts that beat short for the next change or the teardown, without moving the rig twice', async () => {
    const h = harness({ reduced: true, rig: { lidCase: 0, seated: 0, swapping: false } });
    const first = h.swap('b');
    h.prints[0].land();
    await flush();
    const second = h.swap('c');
    await flush();
    expect(first.settled).toBe(true);
    expect(h.rig).toEqual({ lidCase: 1, seated: 1, swapping: true });
    expect(h.prints[1].index).toBe(0);
    h.prints[1].land();
    await flush();
    h.controller.dispose();
    await flush();
    expect(second.settled).toBe(true);
    expect(h.rig).toEqual({ lidCase: 0, seated: 0, swapping: false });
  });
});

describe('createSwapController: seat', () => {
  it.each(['playing', 'paused'] as const)(
    'seats the lid’s disc for a track %s with no change for it, and prints it',
    (status) => {
      const h = harness({ rig: { lidCase: 1, seated: null, swapping: false } });
      h.controller.seat(view({ current: track('a'), status }));
      expect(h.rig).toEqual({ lidCase: 1, seated: 1, swapping: false });
      expect(h.prints.map(({ index, id }) => [index, id])).toEqual([[1, 'a']]);
      // Once seated, the views that follow change nothing.
      h.controller.seat(view({ current: track('b'), status: 'playing' }));
      expect(h.prints).toHaveLength(1);
    },
  );

  it('seats nothing with no track playing, or while a change runs', () => {
    const quiet: Partial<SceneView>[] = [
      { current: track('a'), status: 'idle' },
      { current: track('a'), status: 'swapping' },
      { current: null, status: 'playing' },
    ];
    for (const patch of quiet) {
      const h = harness();
      h.controller.seat(view(patch));
      expect(h.rig.seated, patch.status).toBeNull();
      expect(h.prints).toHaveLength(0);
    }
    const h = harness();
    h.swap('a');
    h.controller.seat(view({ current: track('a'), status: 'paused' }));
    expect(h.rig.seated).toBeNull();
    expect(h.prints).toHaveLength(1);
  });
});
