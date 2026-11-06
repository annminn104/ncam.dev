import { clearSwatch } from '../clear-looks';
import type { Look } from '../looks';
import type { Status } from '../playback/sequencer';

/**
 * The deck's ten-segment VU strip, paced rather than measured: the audio stays inside Spotify's
 * iframe, so the levels are a smooth, deterministic signal of the play time (three sines at
 * unrelated rates under a slow swell), with a peak that holds for 400 ms. Still while paused (the
 * clock stops, `vuFrame`), off when nothing is loaded or nothing has played yet, calm under
 * reduced motion.
 */
export const VU_SEGMENTS = 10;

/** Amber for seven segments, orange for two, red at the top: a classic strip. */
export const VU_COLOURS: readonly string[] = [
  '#ffb85c',
  '#ffb85c',
  '#ffb85c',
  '#ffb85c',
  '#ffb85c',
  '#ffb85c',
  '#ffb85c',
  '#ff8a3d',
  '#ff8a3d',
  '#ff4040',
];

/**
 * The strip's colours for a look: the suitcase's amber to red, or the Clear model's light in ten
 * brightening steps (sRGB, the last being the glow itself).
 */
export function vuColours(look: Look): readonly string[] {
  if (look.model === 'suitcase') return VU_COLOURS;
  const glow = clearSwatch(look.clear, 'light').glow;
  const channel = (at: number, k: number) =>
    Math.round(parseInt(glow.slice(at, at + 2), 16) * k)
      .toString(16)
      .padStart(2, '0');
  return Array.from({ length: VU_SEGMENTS }, (_, i) => {
    const k = 0.45 + (0.55 * i) / (VU_SEGMENTS - 1);
    return `#${channel(1, k)}${channel(3, k)}${channel(5, k)}`;
  });
}

/** An unlit segment. */
export const VU_OFF = '#2b2022';

const TAU = Math.PI * 2;

/** A 0..1 signal of the seconds `t`: lively, or slow and low when `calm`. */
function signal(t: number, calm: boolean): number {
  const s = calm ? 0.18 : 1;
  const x =
    0.5 +
    0.22 * Math.sin(TAU * 1.7 * s * t) +
    0.16 * Math.sin(TAU * 2.9 * s * t + 1.3) +
    0.12 * Math.sin(TAU * 4.3 * s * t + 2.1) +
    0.1 * Math.sin(TAU * 0.23 * t);
  return Math.min(1, Math.max(0, x));
}

/**
 * Each segment's brightness, 0..1, at `timeMs` of play: a lit prefix with a fractional top, and
 * the highest segment reached in the last 400 ms held at half. `playing` is "a track is loaded"
 * (playing or paused): false is every segment off. Fills and returns `out` when given.
 */
export function vuLevels(
  timeMs: number,
  playing: boolean,
  reducedMotion: boolean,
  out: number[] = new Array<number>(VU_SEGMENTS),
): number[] {
  out.length = VU_SEGMENTS;
  if (!playing) {
    out.fill(0);
    return out;
  }
  const t = timeMs / 1000;
  const level = signal(t, reducedMotion) * (reducedMotion ? 0.5 : 1);
  const lit = level * VU_SEGMENTS;
  for (let i = 0; i < VU_SEGMENTS; i++) out[i] = Math.min(1, Math.max(0, lit - i));
  if (!reducedMotion) {
    let peak = lit;
    for (let back = 50; back <= 400; back += 50) {
      peak = Math.max(peak, signal(t - back / 1000, false) * VU_SEGMENTS);
    }
    const top = Math.min(VU_SEGMENTS - 1, Math.floor(peak));
    out[top] = Math.max(out[top], 0.55);
  }
  return out;
}

/**
 * One frame of the strip: from the clock the last frame left (ms of `performance.now()`, null
 * until a track has played) and the bridge's `status` at `now`, fills `out` with the levels and
 * returns the clock to keep. The clock follows `now` while a track plays and holds otherwise, so
 * the strip moves, then stands still while paused. It is dark when nothing is loaded, while a disc
 * changes, and on a paused track until one has played: a scene that boots on a paused track would
 * otherwise freeze the signal's first level.
 */
export function vuFrame(
  clock: number | null,
  status: Status,
  now: number,
  reducedMotion: boolean,
  out: number[],
): number | null {
  const next = status === 'playing' ? now : clock;
  const loaded = next !== null && (status === 'playing' || status === 'paused');
  vuLevels(next ?? 0, loaded, reducedMotion, out);
  return next;
}
