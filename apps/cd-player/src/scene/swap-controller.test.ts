import { describe, expect, it, vi } from 'vitest';
import { EMPTY_VIEW, type SceneView, type TrackView } from '../bridge';
import { ARM_PLAY, DOOR_OPEN_MS, DURATION, type Timeline } from './director';
import { emptyShelf, lineupOf, type PrintSize, type StageState } from './stage';
import {
  createSwapController,
  PRINT_WAIT_MS,
  REDUCED_MOTION_MS,
  SETTLE_SLACK_MS,
  type DiscPrinter,
  type SwapClock,
} from './swap-controller';

const track = (id: string): TrackView => ({
  id,
  title: id,
  artists: 'A',
  artUrl: null,
  artistUrl: null,
});
const MIX = { name: 'Mix', subtitle: 'Owner', key: 'playlist:mix' };
/** A view: `current` in the player (playing; null: nothing), the rest coming next. */
const lineup = (current: string | null, ...upcoming: string[]): SceneView => ({
  ...EMPTY_VIEW,
  collection: MIX,
  current: current === null ? null : track(current),
  upcoming: upcoming.map(track),
  status: current === null ? 'idle' : 'playing',
});
const freshStage = (): StageState => ({
  shelf: emptyShelf(),
  bookletFront: 0,
  filled: false,
  swapping: false,
  last: { armAngle: ARM_PLAY, spin: 1 },
});

/** Lets every pending promise callback run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A controller on a fake clock whose prints land (or fail) when the test says. */
function harness(
  options: { reduced?: boolean; hidden?: boolean; door?: boolean; booklet?: boolean } = {},
) {
  const stage = freshStage();
  /** The page as the controller sees it: hidden or not, and the bridge's view. */
  const page = { hidden: options.hidden ?? false, view: lineup(null) };
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
    disc: number;
    id: string;
    size: PrintSize;
    signal: AbortSignal | undefined;
    land(): void;
    fail(error: Error): void;
  }[] = [];
  const booklets: { side: 0 | 1; id: string | null; land(): void }[] = [];
  const preloads: { id: string; land(): void }[] = [];
  const failed = vi.fn();
  const printer: DiscPrinter = {
    disc: (disc, view, size, signal) =>
      new Promise<void>((resolve, reject) => {
        prints.push({ disc, id: view.id, size, signal, land: resolve, fail: reject });
      }),
    booklet: (side, view) =>
      new Promise<void>((resolve) => {
        booklets.push({ side, id: view?.id ?? null, land: resolve });
      }),
    preload: (view) =>
      new Promise<void>((resolve) => {
        preloads.push({ id: view.id, land: resolve });
      }),
  };
  const controller = createSwapController({
    stage,
    printer,
    view: () => page.view,
    reduced: options.reduced ?? false,
    door: options.door ?? false,
    booklet: options.booklet ?? true,
    hidden: () => page.hidden,
    clock,
    onPrintFailed: failed,
  });
  /** Each pose drawn: the change's timeline and the ms into it. */
  const poses: [Timeline, number][] = [];
  return {
    stage,
    page,
    controller,
    prints,
    booklets,
    preloads,
    failed,
    poses,
    /** Lands every print, booklet side and preload asked for so far. */
    landAll(): void {
      for (const job of [...prints, ...booklets, ...preloads]) job.land();
    },
    /** The disc prints asked for after the first `skip`, as [copy, track, size]. */
    printsAfter(skip: number) {
      return prints.slice(skip).map(({ disc, id, size }) => [disc, id, size]);
    },
    /** Draws a frame at `ms`; true when it posed a change. */
    frame(ms: number): boolean {
      now = ms;
      return controller.frame((plan, t) => poses.push([plan.timeline, t]));
    },
    /** Moves the clock to `ms`, running the timers due. */
    advance(ms: number): void {
      now = ms;
      const due = timers.filter((timer) => timer.at <= ms);
      timers = timers.filter((timer) => timer.at > ms);
      for (const timer of due) timer.done();
    },
    /** Publishes `view`, then asks for the change to `to`, as the engine does. */
    swap(view: SceneView, to: string): { settled: boolean } {
      page.view = view;
      const state = { settled: false };
      void controller.swap(track(to)).then(() => {
        state.settled = true;
      });
      return state;
    },
  };
}

/** A harness whose shelf holds `view` already, its prints landed. */
async function seated(
  view: SceneView,
  options: { reduced?: boolean; hidden?: boolean; door?: boolean } = {},
) {
  const h = harness(options);
  h.page.view = view;
  h.controller.seat(view);
  h.landAll();
  await flush();
  return h;
}

const FULL = lineup('a', 'b', 'c', 'd', 'e', 'f');
const NEXT = lineup('b', 'c', 'd', 'e', 'f', 'g');

describe('createSwapController: seat', () => {
  it('fills the shelf at once as the scene boots, and prints every copy at its place’s size', () => {
    const h = harness();
    h.controller.seat(FULL);
    expect(h.stage.filled).toBe(true);
    expect(lineupOf(h.stage.shelf).current?.id).toBe('a');
    expect(lineupOf(h.stage.shelf).upcoming.map(({ id }) => id)).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(h.printsAfter(0)).toEqual([
      [0, 'a', 1024],
      [1, 'b', 1024],
      [2, 'c', 512],
      [3, 'd', 512],
      [4, 'e', 512],
      [5, 'f', 512],
    ]);
    expect(h.booklets.map(({ side, id }) => [side, id])).toEqual([[0, 'a']]);
    // Once filled (a remount builds a new controller on the same rig), never again.
    h.controller.seat(lineup('x'));
    expect(h.prints).toHaveLength(6);
  });

  it('seats the track in the player whatever its status, and puts the next in the booklet before any', () => {
    const idle = harness();
    idle.controller.seat({ ...lineup('a', 'b'), status: 'idle' });
    expect(idle.stage.shelf.spindle).toBe(0);
    const fresh = harness();
    fresh.controller.seat(lineup(null, 'a', 'b'));
    expect(fresh.stage.shelf.spindle).toBeNull();
    expect(fresh.booklets.map(({ id }) => id)).toEqual(['a']);
  });

  it('fills nothing while a change runs', () => {
    const h = harness();
    h.swap(lineup('a', 'b'), 'a');
    h.controller.seat(lineup('a', 'b'));
    expect(h.stage.filled).toBe(false);
  });
});

describe('createSwapController: a change', () => {
  it('prints and turns no booklet for a model without a jewel case', async () => {
    const h = harness({ booklet: false });
    h.controller.seat(lineup('a', 'b', 'c'));
    h.page.view = lineup('b', 'c', 'd');
    const done = h.controller.swap(track('b'));
    h.landAll();
    await flush();
    h.frame(DURATION.next);
    await done;
    expect(h.booklets).toEqual([]);
    expect(h.stage.bookletFront).toBe(0);
    expect(h.stage.shelf.booklet?.id).toBe('b');
  });

  it('runs next: holds its first pose until the prints are in, plays the timeline, hands the shelf over', async () => {
    const h = await seated(FULL);
    const change = h.swap(NEXT, 'b');
    expect(h.stage.swapping).toBe(true);
    // The new disc for slot 4 on the spare copy, the booklet's hidden side, and the art of the
    // disc that moves up into slot 0 (printed at 1024 px as it moves).
    expect(h.printsAfter(6)).toEqual([[6, 'g', 512]]);
    expect(h.booklets.slice(1).map(({ side, id }) => [side, id])).toEqual([[1, 'b']]);
    expect(h.preloads.map(({ id }) => id)).toEqual(['c']);
    expect(h.frame(100)).toBe(true);
    expect(h.poses.at(-1)).toEqual(['next', 0]);
    h.landAll();
    await flush();
    // The timeline starts as the prints return (the clock read 100 then).
    h.frame(1100);
    expect(h.poses.at(-1)).toEqual(['next', 1000]);
    expect(h.printsAfter(7)).toEqual([]);
    h.frame(1350);
    expect(h.printsAfter(7)).toEqual([[2, 'c', 1024]]);
    await flush();
    expect(change.settled).toBe(false);
    h.frame(100 + DURATION.next);
    expect(h.poses.at(-1)).toEqual(['next', DURATION.next]);
    await flush();
    expect(change.settled).toBe(true);
    expect(h.stage).toMatchObject({ swapping: false, bookletFront: 1 });
    expect(h.stage.shelf.spindle).toBe(1);
    expect(h.stage.shelf.rack).toEqual([2, 3, 4, 5, 6]);
    expect(h.frame(5000)).toBe(false);
  });

  it('runs the change on the prints the copies have when a print fails, and reports it', async () => {
    const h = await seated(lineup('a', 'b', 'c'));
    const change = h.swap(lineup('b', 'c', 'd'), 'b');
    const error = new Error('could not load the art');
    h.prints[3].fail(error);
    h.landAll();
    await flush();
    expect(h.failed).toHaveBeenCalledWith(error, expect.objectContaining({ id: 'd' }));
    expect(h.frame(1000)).toBe(true);
    expect(h.poses.at(-1)).toEqual(['next', 1000]);
    h.frame(DURATION.next);
    await flush();
    expect(change.settled).toBe(true);
    expect(lineupOf(h.stage.shelf).upcoming.map(({ id }) => id)).toEqual(['c', 'd']);
  });

  it('runs anyway once its prints have kept it waiting PRINT_WAIT_MS, and they still land', async () => {
    const h = await seated(FULL);
    const change = h.swap(NEXT, 'b');
    h.advance(PRINT_WAIT_MS - 1);
    expect(h.frame(PRINT_WAIT_MS - 1)).toBe(true);
    expect(h.poses.at(-1)).toEqual(['next', 0]);
    h.advance(PRINT_WAIT_MS);
    h.frame(PRINT_WAIT_MS + 1000);
    expect(h.poses.at(-1)).toEqual(['next', 1000]);
    h.frame(PRINT_WAIT_MS + DURATION.next);
    await flush();
    expect(change.settled).toBe(true);
    // The print was never told to give up: it lands on its copy whenever it can.
    expect(h.prints[6].signal?.aborted).toBe(false);
  });

  it('never throws a print, for a seat or a change, even from a printer that throws', async () => {
    const error = new Error('no 2D canvas');
    const failed = vi.fn();
    const stage = freshStage();
    const throwing: DiscPrinter = {
      disc: () => {
        throw error;
      },
      booklet: () => {
        throw error;
      },
      preload: () => {
        throw error;
      },
    };
    const controller = createSwapController({
      stage,
      printer: throwing,
      view: () => lineup('b', 'c'),
      reduced: false,
      door: false,
      booklet: true,
      hidden: () => false,
      clock: { now: () => 0, after: () => () => {} },
      onPrintFailed: failed,
    });
    controller.seat(lineup('a', 'b'));
    const pending = controller.swap(track('b'));
    await flush();
    expect(failed.mock.calls.map(([thrown, { id }]) => [thrown, id])).toEqual([
      [error, 'a'],
      [error, 'b'],
      [error, 'a'],
      [error, 'c'],
      [error, 'b'],
    ]);
    expect(controller.frame(() => {})).toBe(true);
    controller.dispose();
    await expect(pending).resolves.toBeUndefined();
    expect(stage).toMatchObject({ swapping: false, bookletFront: 1 });
    expect(lineupOf(stage.shelf).current?.id).toBe('b');
  });

  it('settles a change at once when the scene goes mid-print, and its late prints start nothing', async () => {
    const h = await seated(FULL);
    const change = h.swap(NEXT, 'b');
    h.controller.dispose();
    await flush();
    expect(change.settled).toBe(true);
    expect(h.stage.swapping).toBe(false);
    expect(h.stage.shelf.spindle).toBe(1);
    // A scene that has gone prints nothing more.
    expect(h.printsAfter(7)).toEqual([]);
    h.landAll();
    await flush();
    expect(h.frame(500)).toBe(false);
  });

  it('ends a timeline on the clock when no frame comes (the page hidden mid-change), its prints given out', async () => {
    const h = await seated(FULL);
    const change = h.swap(NEXT, 'b');
    h.landAll();
    await flush();
    h.page.hidden = true;
    h.advance(DURATION.next);
    await flush();
    expect(change.settled).toBe(false);
    h.advance(DURATION.next + SETTLE_SLACK_MS);
    await flush();
    expect(change.settled).toBe(true);
    expect(h.printsAfter(7)).toEqual([[2, 'c', 1024]]);
    expect(h.stage.shelf.rack).toEqual([2, 3, 4, 5, 6]);
  });

  it('waits for a door: a first play with one ends on the clock later by the door’s wait', async () => {
    const h = await seated(lineup(null, 'a', 'b', 'c', 'd', 'e'), { door: true });
    const change = h.swap(lineup('a', 'b', 'c', 'd', 'e', 'f'), 'a');
    h.landAll();
    await flush();
    h.page.hidden = true;
    h.advance(DURATION.first + SETTLE_SLACK_MS);
    await flush();
    expect(change.settled).toBe(false);
    h.advance(DURATION.first + DOOR_OPEN_MS + SETTLE_SLACK_MS);
    await flush();
    expect(change.settled).toBe(true);
  });

  it('finishes a change at once in a hidden page, with no frame and no wait for its prints', async () => {
    const h = await seated(FULL, { hidden: true });
    const change = h.swap(NEXT, 'b');
    await flush();
    expect(change.settled).toBe(true);
    expect(h.stage.shelf.spindle).toBe(1);
    expect(h.frame(100)).toBe(false);
    // Its prints still go out, to land whenever they can.
    expect(h.printsAfter(6)).toEqual([
      [6, 'g', 512],
      [2, 'c', 1024],
    ]);
    expect(h.prints[6].signal?.aborted).toBe(false);
  });

  it('finishes a change at once when its prints return while the page is hidden', async () => {
    const h = await seated(FULL);
    const change = h.swap(NEXT, 'b');
    h.page.hidden = true;
    h.landAll();
    await flush();
    expect(change.settled).toBe(true);
    expect(h.frame(100)).toBe(false);
  });

  it('settles a change at once when the scene goes mid-timeline', async () => {
    const h = await seated(FULL);
    const change = h.swap(NEXT, 'b');
    h.landAll();
    await flush();
    h.frame(1000);
    h.controller.dispose();
    await flush();
    expect(change.settled).toBe(true);
    expect(h.stage).toMatchObject({ swapping: false, bookletFront: 1 });
    expect(h.frame(1100)).toBe(false);
  });

  it('ends the change still turning before it starts the next (a new collection, then Play)', async () => {
    const h = await seated(FULL);
    const first = h.swap(NEXT, 'b');
    h.landAll();
    await flush();
    h.frame(500);
    // Another playlist that starts with the track slot 0 now holds (two charts share tracks).
    const other = { name: 'Other', subtitle: 'Someone', key: 'playlist:other' };
    const second = h.swap({ ...lineup('c', 'd', 'e', 'f', 'g', 'h'), collection: other }, 'c');
    await flush();
    expect(first.settled).toBe(true);
    // The first handed its shelf over (b on the spindle, c in slot 0), and the second reads
    // against it as another collection: its track comes in from the side, not from slot 0.
    expect(h.stage.shelf.spindle).toBe(1);
    expect(h.stage.swapping).toBe(true);
    h.frame(600);
    expect(h.poses.at(-1)).toEqual(['side', 0]);
    h.landAll();
    await flush();
    h.frame(600 + DURATION.side);
    await flush();
    expect(second.settled).toBe(true);
    expect(lineupOf(h.stage.shelf)).toMatchObject({ collection: other, current: { id: 'c' } });
    expect(lineupOf(h.stage.shelf).upcoming.map(({ id }) => id)).toEqual(['d', 'e', 'f', 'g', 'h']);
  });

  it('runs a list of one track with an empty rack: the first play, then Next and Previous on Repeat', async () => {
    // Waiting: the one track in slot 0, nothing on the spindle.
    const h = await seated(lineup(null, 'a'));
    const first = h.swap(lineup('a'), 'a');
    h.frame(100);
    expect(h.poses.at(-1)).toEqual(['first', 0]);
    h.landAll();
    await flush();
    h.frame(100 + DURATION.first);
    await flush();
    expect(first.settled).toBe(true);
    expect(h.stage.shelf.rack).toEqual([null, null, null, null, null]);
    expect(lineupOf(h.stage.shelf)).toMatchObject({ current: { id: 'a' }, upcoming: [] });
    // On Repeat, Next and Previous both bring the same track round again: a disc from the side.
    let at = 100 + DURATION.first;
    for (const press of ['next', 'prev']) {
      const change = h.swap(lineup('a'), 'a');
      h.frame(at);
      expect(h.poses.at(-1), press).toEqual(['side', 0]);
      h.landAll();
      await flush();
      at += DURATION.side;
      h.frame(at);
      await flush();
      expect(change.settled, press).toBe(true);
      expect(h.stage.shelf.rack, press).toEqual([null, null, null, null, null]);
      expect(lineupOf(h.stage.shelf).current?.id, press).toBe('a');
    }
    expect(h.failed).not.toHaveBeenCalled();
  });

  it('reads Next on a list of two tracks on Repeat as prev, and ends with the shelf the view shows', async () => {
    // With Repeat on, a playing the next one (and the previous one too) is b, and b's is a.
    const h = await seated(lineup('a', 'b'));
    const change = h.swap(lineup('b', 'a'), 'b');
    h.frame(100);
    expect(h.poses.at(-1)).toEqual(['prev', 0]);
    h.landAll();
    await flush();
    h.frame(100 + DURATION.prev);
    await flush();
    expect(change.settled).toBe(true);
    expect(lineupOf(h.stage.shelf).current?.id).toBe('b');
    expect(lineupOf(h.stage.shelf).upcoming.map(({ id }) => id)).toEqual(['a']);
    expect(h.stage.shelf.rack.slice(1)).toEqual([null, null, null, null]);
  });

  it('ends a change still printing when the next arrives', async () => {
    const h = await seated(FULL);
    const first = h.swap(NEXT, 'b');
    const second = h.swap(lineup('c', 'd', 'e', 'f', 'g', 'h'), 'c');
    await flush();
    expect(first.settled).toBe(true);
    // Only the first change's print lands: the second still holds its first pose.
    h.prints[6].land();
    await flush();
    h.frame(100);
    expect(h.poses.at(-1)).toEqual(['next', 0]);
    expect(second.settled).toBe(false);
  });

  it('tells a copy’s older print to give up once a newer print of that copy starts', () => {
    const h = harness();
    h.controller.seat(lineup('a', 'b'));
    h.swap(lineup('x', 'b'), 'x');
    h.swap(lineup('y', 'b'), 'y');
    expect(h.printsAfter(0)).toEqual([
      [0, 'a', 1024],
      [1, 'b', 1024],
      [2, 'x', 1024],
      [0, 'y', 1024],
    ]);
    expect(h.prints.map(({ signal }) => signal?.aborted)).toEqual([true, false, false, false]);
  });

  it('prints a new disc for a reused copy once it is out of sight, and moving ones as they move', async () => {
    const h = await seated(FULL);
    h.swap(lineup('d', 'e', 'f', 'g', 'h', 'i'), 'd');
    // Before the timeline: the first new disc on the spare copy, the others' art loaded.
    expect(h.printsAfter(6)).toEqual([[6, 'g', 512]]);
    expect(h.preloads.map(({ id }) => id)).toEqual(['d', 'e', 'h', 'i']);
    h.landAll();
    await flush();
    h.frame(599);
    expect(h.printsAfter(7)).toEqual([]);
    // Slot 0's disc has shrunk away by 600 ms (it comes back as h), slot 1's by 690 (as i).
    h.frame(690);
    expect(h.printsAfter(7)).toEqual([
      [1, 'h', 512],
      [2, 'i', 512],
    ]);
    // The picked disc starts down at 900 and slot 3's moves into slot 0 at 1250: 1024 px each.
    h.frame(1250);
    expect(h.printsAfter(9)).toEqual([
      [3, 'd', 1024],
      [4, 'e', 1024],
    ]);
  });

  it('gives out every print a change still holds when it ends early', async () => {
    const h = await seated(FULL);
    h.swap(lineup('d', 'e', 'f', 'g', 'h', 'i'), 'd');
    h.landAll();
    await flush();
    h.frame(100);
    h.swap(lineup('e', 'f', 'g', 'h', 'i', 'j'), 'e');
    expect(h.printsAfter(7).slice(0, 4)).toEqual([
      [3, 'd', 1024],
      [4, 'e', 1024],
      [1, 'h', 512],
      [2, 'i', 512],
    ]);
  });

  it('makes a change instant under reduced motion, and lets the music wait a beat', async () => {
    const h = await seated(lineup('a', 'b', 'c'), { reduced: true });
    const change = h.swap(lineup('b', 'c'), 'b');
    h.landAll();
    await flush();
    expect(h.stage.swapping).toBe(false);
    expect(h.stage.shelf.spindle).toBe(1);
    // The disc that moved into slot 0 is printed at its new size at once.
    expect(h.printsAfter(3)).toEqual([[2, 'c', 1024]]);
    expect(h.frame(0)).toBe(false);
    h.advance(REDUCED_MOTION_MS - 1);
    await flush();
    expect(change.settled).toBe(false);
    h.advance(REDUCED_MOTION_MS);
    await flush();
    expect(change.settled).toBe(true);
  });

  it('cuts that beat short for the next change or the teardown, without moving the stage twice', async () => {
    const h = await seated(lineup('a', 'b', 'c'), { reduced: true });
    const first = h.swap(lineup('b', 'c'), 'b');
    h.landAll();
    await flush();
    const second = h.swap(lineup('c'), 'c');
    await flush();
    expect(first.settled).toBe(true);
    expect(h.stage.swapping).toBe(true);
    expect(h.stage.shelf.spindle).toBe(1);
    h.landAll();
    await flush();
    h.controller.dispose();
    await flush();
    expect(second.settled).toBe(true);
    expect(h.stage.swapping).toBe(false);
    expect(h.stage.shelf.spindle).toBe(2);
  });
});

describe('createSwapController: follow', () => {
  it('plays a cascade for a view that changed with no swap, nobody waiting on it', async () => {
    const h = await seated(FULL);
    // Shuffle while a track plays: the rack's order changes, the disc in the player stays.
    h.controller.follow(lineup('a', 'b', 'f', 'e', 'd', 'c'));
    expect(h.stage.swapping).toBe(true);
    h.landAll();
    await flush();
    expect(h.frame(500)).toBe(true);
    expect(h.poses.at(-1)).toEqual(['cascade', 500]);
    h.frame(DURATION.cascade);
    expect(h.stage.swapping).toBe(false);
    expect(lineupOf(h.stage.shelf).upcoming.map(({ id }) => id)).toEqual(['b', 'f', 'e', 'd', 'c']);
    expect(h.stage.shelf.spindle).toBe(0);
    expect(h.stage.bookletFront).toBe(0);
  });

  it('follows a new collection: the spindle’s disc leaves and the rack fills with its tracks', async () => {
    const h = await seated(FULL);
    const other: SceneView = {
      ...lineup(null, 'p', 'q', 'r', 's', 't'),
      collection: { name: 'Other', subtitle: 'Someone', key: 'playlist:other' },
    };
    h.controller.follow(other);
    h.landAll();
    await flush();
    // The cascade's 1.6 s, then the case's turn once the spindle's disc has gone: 1950 ms.
    h.frame(DURATION.cascade);
    expect(h.stage.swapping).toBe(true);
    h.frame(1950);
    expect(h.stage.swapping).toBe(false);
    expect(lineupOf(h.stage.shelf)).toMatchObject({ current: null, collection: other.collection });
    expect(lineupOf(h.stage.shelf).upcoming.map(({ id }) => id)).toEqual(['p', 'q', 'r', 's', 't']);
    expect(h.stage.bookletFront).toBe(1);
  });

  it('follows nothing before the shelf is filled, when it matches, or while a change runs', async () => {
    const unfilled = harness();
    unfilled.controller.follow(lineup('a', 'b'));
    expect(unfilled.stage.swapping).toBe(false);
    const h = await seated(lineup('a', 'b', 'c'));
    h.controller.follow(lineup('a', 'b', 'c'));
    expect(h.frame(100)).toBe(false);
    h.swap(lineup('b', 'c'), 'b');
    h.controller.follow(lineup('b', 'c', 'x'));
    expect(h.frame(200)).toBe(true);
    expect(h.poses.at(-1)).toEqual(['next', 0]);
  });

  it('takes a collection’s new name alone without moving a disc', async () => {
    const h = await seated(lineup('a', 'b', 'c'));
    const renamed: SceneView = {
      ...lineup('a', 'b', 'c'),
      collection: { name: 'Renamed', subtitle: 'Owner', key: 'playlist:mix' },
    };
    h.controller.follow(renamed);
    expect(h.stage.swapping).toBe(false);
    expect(h.stage.shelf.collection).toEqual(renamed.collection);
  });
});
