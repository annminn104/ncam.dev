import type { StallClock } from '../boot';

/** A clock the test moves by hand: `advance` runs the timers that fall due. */
export function fakeClock() {
  let now = 0;
  let timers: { at: number; done(): void }[] = [];
  const clock: StallClock = {
    after: (ms, done) => {
      const timer = { at: now + ms, done };
      timers.push(timer);
      return () => {
        timers = timers.filter((other) => other !== timer);
      };
    },
  };
  return {
    clock,
    advance(ms: number): void {
      now += ms;
      const due = timers.filter((timer) => timer.at <= now);
      timers = timers.filter((timer) => timer.at > now);
      for (const timer of due) timer.done();
    },
    /** The timers still set. */
    pending: () => timers.length,
  };
}
