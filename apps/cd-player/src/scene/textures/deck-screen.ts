import { xorshift, fnv1a } from './xorshift';

/** The Deck's glass in canvas pixels: 16:9, painted at runtime (170 × 95.6 mm). */
export const DECK_SCREEN = { width: 768, height: 432 } as const;

/** The waveform's bars, across the screen. */
export const WAVE_BARS = 120;

/**
 * The waveform of a track: `WAVE_BARS` heights in [0.18, 1], the same for the same id. The id's
 * FNV-1a hash seeds the stream; each bar is 0.6 of its own draw and 0.4 of the bar before it, so
 * the shape swells rather than flickers.
 */
export function waveHeights(id: string): number[] {
  const draw = xorshift(fnv1a(id));
  const bars: number[] = [];
  let previous = 0.5;
  for (let i = 0; i < WAVE_BARS; i++) {
    previous = 0.6 * draw() + 0.4 * previous;
    bars.push(Math.min(1, Math.max(0.18, previous)));
  }
  return bars;
}

/** How many bars `targetMs` of `durationMs` has played: none without a duration. */
export function playedBars(targetMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return 0;
  const played = Math.floor((WAVE_BARS * targetMs) / durationMs);
  return Math.min(WAVE_BARS, Math.max(0, played));
}

const clock = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** The screen's two times, `m:ss`: the elapsed, and the remaining with a leading `-` (`-:--` without a duration). */
export function screenTimes(
  targetMs: number,
  durationMs: number,
): { elapsed: string; remaining: string } {
  return {
    elapsed: clock(targetMs),
    remaining: durationMs > 0 ? `-${clock(durationMs - targetMs)}` : '-:--',
  };
}
