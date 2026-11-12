// Circuit, the Deck print's traces and chips (see deck-pattern.ts).
import {
  TAU,
  type Zone,
  type Area,
  between,
  whole,
  pick,
  lineOf,
  closes,
  periodOf,
  at,
  dot,
  rounded,
} from './deck-pattern-core';

/** A grid step's directions, in eighths of a turn from +x. */
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
/** A trace's turns at each step, in eighths: mostly on, never more than 90°, so never back. */
const TURNS = [0, 0, 0, 1, -1, 2, -2];
const PIN_PITCH = 2.54;

const overlaps = (a: Zone, b: Zone) =>
  a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/**
 * A chip on a panel: a rounded body of 6–14 × 8–18 mm, clear of those `placed`, with pins along its
 * long sides at 2.54 mm, pin 1 and its mark in the accent. Gives its footprint.
 */
function chip(ctx: CanvasRenderingContext2D, area: Area, placed: readonly Zone[]): Zone {
  const { random, inks } = area;
  const bw = between(random, 6, 14);
  const bh = between(random, 8, 18);
  const leg = 1.6;
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 6; tries++) {
    x = between(random, 3 + leg, area.w - 3 - leg - bw);
    y = between(random, 3 + leg, area.h - 3 - leg - bh);
    if (!placed.some((zone) => overlaps(zone, [x - 4, y - 4, bw + 8, bh + 8]))) break;
  }
  ctx.strokeStyle = inks.line;
  ctx.lineWidth = lineOf(area, 0.6);
  ctx.beginPath();
  rounded(ctx, x, y, bw, bh, 1);
  ctx.stroke();
  const tall = bh >= bw;
  const long = tall ? bh : bw;
  const count = Math.max(2, Math.floor((long - 1.5) / PIN_PITCH));
  const first = (long - (count - 1) * PIN_PITCH) / 2;
  const pin = lineOf(area, 0.8);
  for (let side = 0; side < 2; side++) {
    for (let p = 0; p < count; p++) {
      ctx.fillStyle = side === 0 && p === 0 ? inks.accent : inks.line;
      const s = first + p * PIN_PITCH - pin / 2;
      if (tall) ctx.fillRect(side === 0 ? x - leg : x + bw, y + s, leg, pin);
      else ctx.fillRect(x + s, side === 0 ? y - leg : y + bh, pin, leg);
    }
  }
  ctx.fillStyle = inks.accent;
  dot(ctx, area, x + 1.8, y + 1.8, 0.6);
  return [x - leg, y - leg, bw + 2 * leg, bh + 2 * leg];
}

/**
 * Circuit: a grid every 6–9 mm, from a seeded third of whose points a trace walks 3–9 steps,
 * turning 0°, 45° or 90° and never back on itself or onto another, to a pad (a ring, in the
 * accent) or a via (a dot); on panels, 1–3 chips first. On the rim the grid is polar: a step along
 * is an arc, a step across a radius, and the grid joins at the seam.
 */
export function circuit(ctx: CanvasRenderingContext2D, area: Area): void {
  const { random, w, h, inks } = area;
  const step = periodOf(area, between(random, 6, 9));
  const cols = closes(area) ? Math.round(w / step) : Math.floor((w - 4) / step) + 1;
  const rows = Math.max(1, Math.floor((h - 4) / step) + 1);
  const x0 = closes(area) ? step / 2 : (w - (cols - 1) * step) / 2;
  const y0 = (h - (rows - 1) * step) / 2;
  const point = (i: number, j: number): [number, number] => [x0 + i * step, y0 + j * step];
  const taken = new Set<number>();
  const crossed = new Set<number>();
  const free = (i: number, j: number) =>
    i >= 0 && i < cols && j >= 0 && j < rows && !taken.has(j * cols + i);
  if (area.region.kind === 'panel') {
    const placed: Zone[] = [];
    for (let n = whole(random, 1, 3); n > 0; n--) placed.push(chip(ctx, area, placed));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const [px, py] = point(i, j);
        if (placed.some((zone) => overlaps(zone, [px - 2, py - 2, 4, 4]))) taken.add(j * cols + i);
      }
    }
  }
  ctx.strokeStyle = inks.line;
  ctx.lineWidth = lineOf(area, 0.6);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const ends: [number, number, boolean][] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (random() >= 1 / 3 || !free(i, j)) continue;
      taken.add(j * cols + i);
      const path = [point(i, j)];
      // A single row (the bezel) runs along it only.
      let dir = rows === 1 ? 4 * whole(random, 0, 1) : whole(random, 0, 7);
      for (let s = whole(random, 3, 9), ci = i, cj = j; s > 0; s--) {
        const next = rows === 1 ? dir : (dir + pick(random, TURNS) + 8) % 8;
        const [di, dj] = DIRS[next];
        const cell = Math.min(cj, cj + dj) * cols + Math.min(ci, ci + di);
        const diagonal = di !== 0 && dj !== 0;
        if (!free(ci + di, cj + dj) || (diagonal && crossed.has(cell))) break;
        if (diagonal) crossed.add(cell);
        ci += di;
        cj += dj;
        dir = next;
        taken.add(cj * cols + ci);
        path.push(point(ci, cj));
      }
      if (path.length < 2) continue;
      ctx.beginPath();
      for (const [px, py] of path) ctx.lineTo(px, py);
      ctx.stroke();
      ends.push([...path[0], false], [...path[path.length - 1], random() < 0.5]);
    }
  }
  // Past the cut, a pad's ring keeps a hole 3 px across, and a via stands twice a trace's width.
  const ring = Math.max(0.8, 1.5 / area.k + area.hair / 2);
  for (const [x, y, pad] of ends) {
    if (!pad) {
      ctx.fillStyle = inks.line;
      dot(ctx, area, x, y, Math.max(0.5, area.hair));
      continue;
    }
    at(ctx, area, x, y, 0, () => {
      ctx.strokeStyle = inks.accent;
      ctx.lineWidth = area.hair;
      ctx.beginPath();
      ctx.arc(0, 0, ring, 0, TAU);
      ctx.stroke();
    });
  }
}
