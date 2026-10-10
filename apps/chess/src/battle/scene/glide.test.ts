import { describe, expect, it } from 'vitest';
import { ARC_HEIGHT, MOVE_MS, TRAIL_MS, glideAt, glideDone, trailSpan, type Glide } from './glide';

const glide = (elapsed = 0): Glide => ({
  from: [-1.5, 2.5],
  fromY: 0.25,
  to: [0.5, -1.5],
  elapsed,
});
const at = (g: Glide, t: number) => glideAt(g, t, { x: NaN, y: NaN, z: NaN });
function spanAt(elapsed: number): [tail: number, head: number] {
  const span = trailSpan(elapsed);
  if (!span) throw new Error(`no trail ${elapsed} ms after take-off`);
  return span;
}

describe('glideAt', () => {
  it('takes off where the piece was, lifted, and lands on its square', () => {
    const g = glide();
    expect(at(g, 0)).toEqual({ x: -1.5, y: 0.25, z: 2.5 });
    const end = at(g, 1);
    expect(end.x).toBeCloseTo(0.5);
    expect(end.z).toBeCloseTo(-1.5);
    expect(end.y).toBeCloseTo(0);
  });

  it('arcs over the board, highest halfway', () => {
    const g = glide();
    const mid = at(g, 0.5);
    expect(mid.y).toBeCloseTo(0.25 / 2 + ARC_HEIGHT);
    for (const t of [0.1, 0.3, 0.7, 0.9]) expect(at(g, t).y).toBeLessThan(mid.y);
    // Halfway across in the middle: the ease is symmetric.
    expect(mid.x).toBeCloseTo(-0.5);
    expect(mid.z).toBeCloseTo(0.5);
  });

  it('writes into the point it is given, and returns it', () => {
    const out = { x: 0, y: 0, z: 0 };
    expect(glideAt(glide(), 0.25, out)).toBe(out);
  });
});

describe('trailSpan', () => {
  it('draws nothing before take-off', () => {
    expect(trailSpan(0)).toBeNull();
  });

  it('runs from where the piece took off to where it is, until the tail gets going', () => {
    const [tail, head] = spanAt(TRAIL_MS / 2);
    expect(tail).toBe(0);
    expect(head).toBeCloseTo(TRAIL_MS / 2 / MOVE_MS);
  });

  it('then trails TRAIL_MS behind the piece', () => {
    const elapsed = TRAIL_MS + 40;
    const [tail, head] = spanAt(elapsed);
    expect(head - tail).toBeCloseTo(TRAIL_MS / MOVE_MS);
  });

  it('shrinks into the landing square once the piece is down, then is gone', () => {
    const [tail, head] = spanAt(MOVE_MS + TRAIL_MS / 2);
    expect(head).toBe(1);
    expect(tail).toBeGreaterThan(0);
    expect(tail).toBeLessThan(1);
    expect(trailSpan(MOVE_MS + TRAIL_MS)).toBeNull();
    expect(trailSpan(MOVE_MS + TRAIL_MS + 500)).toBeNull();
  });

  it('writes into the pair it is given, so a frame loop allocates nothing', () => {
    const out: [number, number] = [NaN, NaN];
    expect(trailSpan(MOVE_MS / 2, out)).toBe(out);
    expect(out).toEqual(spanAt(MOVE_MS / 2));
  });
});

describe('glideDone', () => {
  it('keeps the glide until its trail has landed too', () => {
    expect(glideDone(glide(MOVE_MS))).toBe(false);
    expect(glideDone(glide(MOVE_MS + TRAIL_MS - 1))).toBe(false);
    expect(glideDone(glide(MOVE_MS + TRAIL_MS))).toBe(true);
  });
});
