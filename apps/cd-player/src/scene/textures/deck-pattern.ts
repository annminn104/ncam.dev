import type { FrameSwatch, LightSwatch } from '../../clear-looks';
import type { PatternStyle } from '../../personal';
import { pxPerMm, type AtlasRegion, type DeckAtlas, type Ground } from './deck-atlas';
import { fitText } from './layout';
import { bold, context, semibold } from './paint';
import { fnv1a, xorshift } from './xorshift';

/**
 * The Deck's print layer (the spec's "Personal patterns"): one of five patterns over every zone of
 * the atlas (deck-atlas.ts), in the light's three colours and two neutrals, its variant seeded by
 * the collection, and the visitor's name engraved on the nameplate and stencilled on the flight
 * case. Every region is painted in mm, from a stream of its own, so a print repaints the same.
 *
 * The material cuts at alphaTest 0.5, so the painter draws opaque or not at all: no alpha but 1,
 * no gradient, no blur, and no line under 2 px, which the cut would lose.
 */

/** The two neutrals the prints add to the light's three colours. */
export const ATLAS_LIGHT = '#f4f3ee';
export const ATLAS_DARK = '#141416';

export interface PatternPrint {
  /** null: Plain, the name only. */
  readonly style: PatternStyle | null;
  readonly seed: number;
  readonly light: LightSwatch;
  readonly body: FrameSwatch;
  /** personal.ts engraving(): never empty. */
  readonly name: string;
  /** The collection's name, '' before one is loaded. */
  readonly collection: string;
}

export interface Inks {
  /** Lines and letters. */
  readonly line: string;
  /** Highlights: pads, playheads, a tag's fill. */
  readonly accent: string;
  /** Sticker fills, in this order. */
  readonly fills: readonly string[];
}

/** What the stickers say, the stream choosing. */
export const STICKER_WORDS: readonly string[] = [
  'ncam',
  'PLAY LOUD',
  'B2B',
  '128 BPM',
  'NO SKIPS',
  'ONE MORE',
  'DROP',
  'LOOP',
  'CUE',
  'SIDE A',
  'LIVE',
  'ENCORE',
  'REWIND',
  'MIXTAPE',
  'AFTER HOURS',
  'BASS',
];

/** A collection's seed: its `type:id` hashed (Task 8d), so it prints the same on every visit. */
export function collectionSeed(key: string | null): number {
  return fnv1a(key ?? '');
}

/** WCAG 2's relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const v = parseInt(hex.slice(at, at + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The neutral that reads on `fill`: the one of more contrast with it. */
function inkOn(fill: string): string {
  const l = luminance(fill);
  const onLight = (luminance(ATLAS_LIGHT) + 0.05) / (l + 0.05);
  const onDark = (l + 0.05) / (luminance(ATLAS_DARK) + 0.05);
  return onLight >= onDark ? ATLAS_LIGHT : ATLAS_DARK;
}

/**
 * The inks that read on a ground: light lines and the glow on a dark one (the case, the acrylic,
 * the glass, and a body under 0.35 in luminance), dark lines and the on-accent on a light one.
 */
export function inksFor(ground: Ground, print: PatternPrint): Inks {
  const dark =
    ground === 'case' ||
    ground === 'acrylic' ||
    ground === 'glass' ||
    (ground === 'body' && luminance(print.body.colour) < 0.35);
  const { glow, accent, onAccent } = print.light;
  return {
    line: dark ? ATLAS_LIGHT : ATLAS_DARK,
    accent: dark ? glow : onAccent,
    fills: [glow, accent, onAccent, ATLAS_LIGHT, ATLAS_DARK],
  };
}

/** What a print depends on: the atlas is painted again only when it changes. */
export function patternKey(print: PatternPrint): string {
  const { style, seed, light, body, name, collection } = print;
  return [style ?? 'plain', seed, light.id, body.id, name, collection].join('\n');
}

const TAU = Math.PI * 2;
/** Manrope's cap height, per em (measured in Chromium): capitals are centred and cut by it. */
const CAP = 0.72;
/** How far a capital's marks rise over the cap height (Ẫ's reach 1.14 em) and a dot below falls. */
const MARKS_ABOVE = 0.42;
const MARKS_BELOW = 0.2;
const DOT_BELOW = String.fromCodePoint(0x323);
/** The top's print opens round the jog out to the signature ring (deck_print.py): r 120 mm. */
export const JOG_OPENING = 120;
/** The share of the stencil's region, from its top, that its stencil cuts clear. */
const STENCIL_BAND = 0.4;

/** What a line of capitals needs over its cap height and under its baseline, per em: its marks. */
function reach(text: string): { above: number; below: number } {
  const marks = [...text.normalize('NFD')].filter((char) => /\p{M}/u.test(char));
  return {
    above: marks.some((mark) => mark !== DOT_BELOW) ? MARKS_ABOVE : 0,
    below: marks.includes(DOT_BELOW) ? MARKS_BELOW : 0,
  };
}

type Zone = readonly [x: number, y: number, w: number, h: number];

/**
 * Where each region's print shows clear of its openings (art/blender/scripts/deck_print.py), in
 * its mm, the best first: the names and the tags go there. The top opens round the jog and at every
 * control, so they go in front of the jog, left of it between the keys, and behind it left of the
 * pads. The sides open at their vents (the front half first), the front at its ports and the
 * nameplate, the case's sides at their ribs, and the case's front shows under its stencil on
 * either side of the tag that hangs there. A region not listed shows whole.
 */
export const OPEN: Readonly<Record<string, readonly Zone[]>> = {
  top: [
    [58, 306, 198, 39],
    [2, 125, 61, 90],
    [2, 65, 90, 37],
  ],
  case_front: [
    [3, 47, 43, 38],
    [92, 47, 43, 38],
  ],
  case_left: [[3, 28, 111, 32]],
  case_right: [[3, 28, 111, 32]],
  side_left: [
    [207, 3, 133, 52],
    [3, 3, 133, 52],
  ],
  side_right: [
    [3, 3, 133, 52],
    [207, 3, 133, 52],
  ],
  front: [
    [155, 3, 59, 52],
    [3, 37, 150, 18],
    [3, 3, 150, 17],
  ],
};

/** A region as its painter sees it: its size in mm, its density, its inks and its own stream. */
interface Area {
  readonly region: AtlasRegion;
  readonly w: number;
  readonly h: number;
  /** Pixels per mm. */
  readonly k: number;
  /** The thinnest line the cut keeps: max(0.5, 2 / k) mm, more on the rim where x is squeezed. */
  readonly hair: number;
  readonly inks: Inks;
  readonly random: () => number;
  readonly print: PatternPrint;
}

function areaOf(region: AtlasRegion, print: PatternPrint): Area {
  const k = pxPerMm(region);
  const mid = region.mmW / TAU;
  // The rim's outer edge squeezes x by r_mid / r_outer, so its lines widen to keep 2 px there.
  const squeeze = region.kind === 'ring' ? (mid + region.mmH / 2) / mid : 1;
  return {
    region,
    w: region.mmW,
    h: region.mmH,
    k,
    hair: Math.max(0.5, 2 / k) * squeeze,
    inks: inksFor(region.ground, print),
    random: xorshift((print.seed ^ fnv1a(region.id)) >>> 0),
    print,
  };
}

const between = (random: () => number, lo: number, hi: number) => lo + random() * (hi - lo);
const whole = (random: () => number, lo: number, hi: number) =>
  lo + Math.floor(random() * (hi - lo + 1));
const pick = <T>(random: () => number, list: readonly T[]): T =>
  list[Math.floor(random() * list.length)];

/** `list` shuffled by the stream (Fisher–Yates: the same order in every engine). */
function shuffled<T>(random: () => number, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A line `mm` wide, or the thinnest the cut keeps where that is wider. */
const lineOf = (area: Area, mm: number) => Math.max(mm, area.hair);

/** Whether a region closes on itself along x (the rim, the bezel): its motifs must join there. */
const closes = (area: Area) => area.region.kind === 'ring' || area.region.kind === 'band';

/** A period near `length` that a closed region's width divides, so a motif joins at its seam. */
const periodOf = (area: Area, length: number) =>
  closes(area) ? area.w / Math.max(1, Math.round(area.w / length)) : length;

/** The rim's radius (mm) at row y: row 0 is its outer edge once flipped (r_mid ± mmH / 2). */
const radiusAt = (area: Area, y: number) => area.w / TAU + area.h / 2 - y;

/** How many mm of x one mm along the rim spans at row y (r_mid / r); 1 on a flat region. */
const along = (area: Area, y: number) =>
  area.region.kind === 'ring' ? area.w / TAU / radiusAt(area, y) : 1;

/** Draws `draw` round (x, y) in true mm, turned `turn`: on the rim, x squeezed as the arc is. */
function at(
  ctx: CanvasRenderingContext2D,
  area: Area,
  x: number,
  y: number,
  turn: number,
  draw: () => void,
): void {
  ctx.save();
  ctx.translate(x, y);
  const squeeze = along(area, y);
  if (squeeze !== 1) ctx.scale(squeeze, 1);
  if (turn) ctx.rotate(turn);
  draw();
  ctx.restore();
}

/** A dot of radius `r`, at least 2 px across, round on the rim too. */
function dot(ctx: CanvasRenderingContext2D, area: Area, x: number, y: number, r: number): void {
  const radius = Math.max(r, 1 / area.k);
  ctx.beginPath();
  ctx.ellipse(x, y, radius * along(area, y), radius, 0, 0, TAU);
  ctx.fill();
}

/** A star's outline round (x, y): `points` points of radius r, its inner radius r · inner. */
function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  points: number,
  inner: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 2 * points; i++) {
    const a = (i * Math.PI) / points;
    const radius = i % 2 === 0 ? r : r * inner;
    ctx.lineTo(x + Math.sin(a) * radius, y - Math.cos(a) * radius);
  }
  ctx.closePath();
}

/** A rounded rectangle's outline. */
function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const q = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

/**
 * Sets `face` at the size (mm) at which `text` fills `room`, at most `max` and at least `min`, and
 * gives that size and the text, with an ellipsis (fitText) only where `min` is still too wide.
 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  face: (px: number) => string,
  text: string,
  room: number,
  max: number,
  min = max / 2,
): { size: number; text: string } {
  ctx.font = face(max);
  const full = ctx.measureText(text).width;
  // A little under the linear size: a face's widths do not scale exactly with its size.
  const fits = full > 0 ? (0.98 * max * room) / full : max;
  const size = Math.floor(Math.max(min, Math.min(max, fits)) * 100) / 100;
  ctx.font = face(size);
  return { size, text: fitText((s) => ctx.measureText(s).width, text, room) };
}

/** The jog's centre, in the top plate's mm. */
function centreOf(area: Area): [number, number] {
  const [cx, cy] = area.region.centre ?? [0, 0];
  return [cx / area.k, cy / area.k];
}

/** How far the region's farthest corner stands from (x, y). */
const farthest = (area: Area, x: number, y: number) =>
  Math.hypot(Math.max(x, area.w - x), Math.max(y, area.h - y));

/** `n` zones for a region's names and tags (OPEN), the largest halved while there are too few. */
function zones(area: Area, n: number): Zone[] {
  const list: Zone[] = [...(OPEN[area.region.id] ?? [[3, 3, area.w - 6, area.h - 6]])];
  while (list.length < n) {
    const i = list.reduce(
      (best, z, j) => (z[2] * z[3] > list[best][2] * list[best][3] ? j : best),
      0,
    );
    const [x, y, w, h] = list[i];
    const halves: Zone[] =
      w >= h
        ? [
            [x, y, w / 2, h],
            [x + w / 2, y, w / 2, h],
          ]
        : [
            [x, y, w, h / 2],
            [x, y + h / 2, w, h / 2],
          ];
    list.splice(i, 1, ...halves);
  }
  return list.slice(0, n);
}

/**
 * Guilloché, engine-turned lines as on a watch dial, in the line ink: on the top, wavy rings round
 * the jog every 2.2–3.4 mm, r(θ) = r₀ + a·sin(kθ + iφ); elsewhere wavy lines across every 2.5–4 mm,
 * y = y₀ + a·sin(2πx/λ + iφ), whose waves join at the rim's and the bezel's seams.
 */
function guilloche(ctx: CanvasRenderingContext2D, area: Area): void {
  const { random, w, h } = area;
  ctx.strokeStyle = area.inks.line;
  ctx.lineWidth = lineOf(area, 0.5);
  ctx.lineJoin = 'round';
  if (area.region.kind === 'plate') {
    const step = between(random, 2.2, 3.4);
    const k = pick(random, [12, 16, 18, 24]);
    const a = between(random, 0.6, 1.2);
    const phi = between(random, 0.15, 0.5);
    const [cx, cy] = centreOf(area);
    // Nothing inside the jog's opening shows: the rings start at its edge.
    for (let i = 0, r0 = JOG_OPENING - step; r0 < farthest(area, cx, cy) + a; i++, r0 += step) {
      const n = Math.ceil(TAU * r0);
      ctx.beginPath();
      for (let j = 0; j <= n; j++) {
        const t = (j / n) * TAU;
        const r = r0 + a * Math.sin(k * t + i * phi);
        ctx.lineTo(cx + r * Math.sin(t), cy - r * Math.cos(t));
      }
      ctx.closePath();
      ctx.stroke();
    }
    return;
  }
  const step = between(random, 2.5, 4);
  const lambda = periodOf(area, between(random, 14, 30));
  const a = between(random, 0.6, 1.2);
  const phi = between(random, 0.15, 0.5);
  for (let i = 0, y0 = between(random, 0, step); y0 < h + a; i++, y0 += step) {
    ctx.beginPath();
    for (let x = 0; x <= w + 1; x += 1) {
      ctx.lineTo(x, y0 + a * Math.sin((TAU * x) / lambda + i * phi));
    }
    ctx.stroke();
  }
}

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
function circuit(ctx: CanvasRenderingContext2D, area: Area): void {
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

/** `count` heights in [0, 1]: slow swells and some grain, as a spectrum looks, joining round. */
function swells(random: () => number, count: number): number[] {
  const parts = [
    [whole(random, 1, 3), 0.5],
    [whole(random, 4, 9), 0.3],
    [whole(random, 10, 24), 0.2],
  ].map(([cycles, a]) => [cycles, a, between(random, 0, TAU)]);
  const raw = Array.from(
    { length: count },
    (_, i) =>
      parts.reduce(
        (sum, [cycles, a, phi]) => sum + a * Math.sin((TAU * cycles * i) / count + phi),
        0,
      ) +
      0.45 * random(),
  );
  const lo = Math.min(...raw);
  const hi = Math.max(...raw);
  return raw.map((v) => (v - lo) / (hi - lo || 1));
}

/** The height over which the tallest `share` of `heights` stand. */
const tallest = (heights: readonly number[], share: number) =>
  [...heights].sort((a, b) => b - a)[Math.floor(heights.length * share)] ?? 1;

/**
 * Sound waves: on the top, 6–12 closed waveforms round the jog, r(θ) = r₀ + Σ₃ aⱼ·sin(kⱼθ + φⱼ);
 * on panels and the bezel, 3–5 oscilloscope traces of summed sines across, over a row of spectrum
 * bars 1.2 mm wide on panels; on the rim, bars rising from its inner edge. One trace and the
 * tallest bars are in the accent, the rest in the line ink.
 */
function waves(ctx: CanvasRenderingContext2D, area: Area): void {
  const { random, w, h, inks } = area;
  ctx.lineWidth = lineOf(area, 0.6);
  ctx.lineJoin = 'round';
  const bar = Math.max(1.2, area.hair);
  if (area.region.kind === 'plate') {
    const [cx, cy] = centreOf(area);
    const count = whole(random, 6, 12);
    const lit = whole(random, 0, count - 1);
    const span = farthest(area, cx, cy) - JOG_OPENING - 8;
    for (let i = 0; i < count; i++) {
      const r0 = JOG_OPENING + 4 + (span * (i + between(random, 0.3, 0.7))) / count;
      const parts = [
        [between(random, 1, 2.5), whole(random, 3, 8)],
        [between(random, 0.6, 1.6), whole(random, 18, 40)],
        [between(random, 0.3, 0.9), whole(random, 70, 140)],
      ].map(([a, k]) => [a, k, between(random, 0, TAU)]);
      const n = Math.ceil(2 * TAU * r0);
      ctx.strokeStyle = i === lit ? inks.accent : inks.line;
      ctx.beginPath();
      for (let j = 0; j <= n; j++) {
        const t = (j / n) * TAU;
        const r = r0 + parts.reduce((sum, [a, k, phi]) => sum + a * Math.sin(k * t + phi), 0);
        ctx.lineTo(cx + r * Math.sin(t), cy - r * Math.cos(t));
      }
      ctx.closePath();
      ctx.stroke();
    }
    return;
  }
  if (area.region.kind === 'ring') {
    const count = Math.round(w / between(random, 2.2, 3));
    const pitch = w / count;
    const heights = swells(random, count);
    const top = tallest(heights, 0.12);
    heights.forEach((height, i) => {
      const rise = (0.15 + 0.8 * height) * h;
      ctx.fillStyle = height >= top ? inks.accent : inks.line;
      ctx.fillRect(i * pitch + (pitch - bar) / 2, h - rise, bar, rise);
    });
    return;
  }
  const panel = area.region.kind === 'panel';
  const traces = whole(random, 3, 5);
  const lit = whole(random, 0, traces - 1);
  const row = (panel ? 0.6 * h : h) / traces;
  for (let t = 0; t < traces; t++) {
    const mid = panel ? row * (t + 0.5) : h / 2;
    const amp = panel ? 0.42 * row : 0.3 * h;
    // Whole cycles across, so that the bezel's traces join; periods near 60–200, 15–40, 4–9 mm.
    const parts = [
      [1, Math.max(1, Math.round(w / between(random, 60, 200)))],
      [0.45, Math.max(1, Math.round(w / between(random, 15, 40)))],
      [0.2, Math.max(1, Math.round(w / between(random, 4, 9)))],
    ].map(([a, cycles]) => [a, cycles, between(random, 0, TAU)]);
    ctx.strokeStyle = t === lit ? inks.accent : inks.line;
    ctx.beginPath();
    for (let x = 0; x <= w + 0.5; x += 0.5) {
      const y = parts.reduce((sum, [a, c, phi]) => sum + a * Math.sin((TAU * c * x) / w + phi), 0);
      ctx.lineTo(x, mid + (amp * y) / 1.65);
    }
    ctx.stroke();
  }
  if (!panel) return;
  const pitch = between(random, 2, 2.6);
  const heights = swells(random, Math.floor((w - 2) / pitch));
  const top = tallest(heights, 0.12);
  heights.forEach((height, i) => {
    const rise = 0.3 * h * (0.12 + 0.88 * height);
    ctx.fillStyle = height >= top ? inks.accent : inks.line;
    ctx.fillRect(1 + i * pitch + (pitch - bar) / 2, h - 1.5 - rise, bar, rise);
  });
}

type Shape = 'circle' | 'rounded' | 'burst' | 'arrow' | 'tape';
const SHAPES: readonly Shape[] = ['circle', 'rounded', 'burst', 'arrow', 'tape'];
/** A sticker's die-cut edge, in ATLAS_LIGHT round its fill. */
const EDGE = 1;
/** How far a sticker turns either way; a name's label turns less, so that it reads. */
const TURN = (25 * Math.PI) / 180;
const LABEL_TURN = (12 * Math.PI) / 180;

interface Sticker {
  readonly x: number;
  readonly y: number;
  readonly turn: number;
  readonly shape: Shape;
  readonly w: number;
  readonly h: number;
  readonly fill: string;
  readonly word: string;
  /** A burst's points. */
  readonly points?: number;
}

/** A sticker's fills: never the light neutral on a light ground, where it would vanish. */
const fillsOn = (area: Area) =>
  area.inks.line === ATLAS_DARK
    ? area.inks.fills.filter((f) => f !== ATLAS_LIGHT)
    : area.inks.fills;

/** The width a sticker's word may take, and its largest size (mm). */
function wordRoom(shape: Shape, w: number, h: number): { room: number; max: number } {
  if (shape === 'circle') return { room: 0.76 * w, max: 0.3 * w };
  if (shape === 'burst') return { room: 0.6 * w, max: 0.24 * w };
  if (shape === 'arrow') return { room: 0.84 * (w - h / 2), max: 0.46 * h };
  return { room: 0.84 * w, max: (shape === 'tape' ? 0.55 : 0.46) * h };
}

/** A sticker's outline round the origin. */
function outline(ctx: CanvasRenderingContext2D, s: Sticker): void {
  const [hw, hh] = [s.w / 2, s.h / 2];
  if (s.shape === 'burst') return star(ctx, 0, 0, hw, s.points ?? 10, 0.8);
  ctx.beginPath();
  if (s.shape === 'circle') ctx.arc(0, 0, hw, 0, TAU);
  else if (s.shape === 'rounded') rounded(ctx, -hw, -hh, s.w, s.h, 0.3 * s.h);
  else if (s.shape === 'arrow') {
    for (const [px, py] of [
      [-hw, -hh],
      [hw - hh, -hh],
      [hw, 0],
      [hw - hh, hh],
      [-hw, hh],
      [-hw + hh * 0.6, 0],
    ]) {
      ctx.lineTo(px, py);
    }
  } else {
    // Tape: torn ends, four teeth each.
    for (let i = 0; i <= 8; i++) ctx.lineTo(hw - (i % 2) * 0.9, -hh + (i * s.h) / 8);
    for (let i = 0; i <= 8; i++) ctx.lineTo(-hw + (i % 2) * 0.9, hh - (i * s.h) / 8);
  }
  ctx.closePath();
}

/** A sticker: its light edge, its fill, and its word in the neutral that reads on the fill. */
function sticker(ctx: CanvasRenderingContext2D, s: Sticker): void {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.turn);
  outline(ctx, s);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ATLAS_LIGHT;
  ctx.lineWidth = 2 * EDGE;
  ctx.stroke();
  ctx.fillStyle = s.fill;
  ctx.fill();
  if (s.word) {
    const { room, max } = wordRoom(s.shape, s.w, s.h);
    const { size, text } = fitFont(ctx, bold, s.word, room, max, 0.6 * max);
    ctx.fillStyle = inkOn(s.fill);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, s.shape === 'arrow' ? -s.h / 4 : 0, (CAP * size) / 2);
  }
  ctx.restore();
}

/**
 * A spot for a sticker, where it shows: on the top, in one of its open zones (chosen by their
 * area: the jog and the screen take most of it); under the stencil on its region; anywhere else
 * `margin` in from the edges.
 */
function somewhere(area: Area, margin: number): [number, number] {
  const { random, region, w, h } = area;
  const open = region.kind === 'plate' ? OPEN[region.id] : undefined;
  if (open) {
    let left = random() * open.reduce((sum, zone) => sum + zone[2] * zone[3], 0);
    const [x, y, zw, zh] = open.find((zone) => (left -= zone[2] * zone[3]) < 0) ?? open[0];
    return [between(random, x, x + zw), between(random, y, y + zh)];
  }
  const top = region.stencil ? STENCIL_BAND * h : 0;
  return [between(random, margin, w - margin), between(random, top + margin, h - margin)];
}

/** A text's width in bold at 10 mm, the size the stickers' sums start from. */
function measured(ctx: CanvasRenderingContext2D, text: string): number {
  ctx.font = bold(10);
  return ctx.measureText(text).width;
}

/**
 * The sticker that carries a name: a label or a strip of tape as long as its text needs at its
 * largest, turned up to ±12° and shrunk until it fits `zone`.
 */
function label(ctx: CanvasRenderingContext2D, area: Area, zone: Zone, text: string): Sticker {
  const { random } = area;
  const [zx, zy, zw, zh] = zone;
  const turn = between(random, -LABEL_TURN, LABEL_TURN);
  const shape = pick(random, ['rounded', 'tape'] as const);
  const tall = Math.min(18, 0.62 * zh);
  const long = (measured(ctx, text) * wordRoom(shape, 1, tall).max) / 10 / 0.8;
  const cos = Math.cos(turn);
  const sin = Math.abs(Math.sin(turn));
  const scale = Math.min(
    1,
    (0.94 * zw) / (long * cos + tall * sin),
    (0.94 * zh) / (long * sin + tall * cos),
  );
  return {
    x: zx + zw / 2 + between(random, -0.05, 0.05) * zw,
    y: zy + zh / 2 + between(random, -0.05, 0.05) * zh,
    turn,
    shape,
    w: long * scale,
    h: tall * scale,
    fill: pick(random, fillsOn(area)),
    word: text,
  };
}

/**
 * Sticker bomb: one sticker per 900 mm² (3 to 40), overlapping, each turned up to ±25°: circles,
 * labels, bursts, arrow badges and strips of tape, each with a light die-cut edge and a word from
 * STICKER_WORDS. On the top and every panel, one carries the collection's name and, over all, one
 * the name. The rim and the bezel take small dots and stars only.
 */
function stickers(ctx: CanvasRenderingContext2D, area: Area): void {
  const { random, w, h, print } = area;
  const count = Math.min(40, Math.max(3, Math.floor((w * h) / 900)));
  if (closes(area)) {
    const most = area.region.kind === 'band' ? 1.4 : 3.2;
    for (let i = 0; i < count; i++) {
      const y = between(random, 0.25 * h, 0.75 * h);
      const r = between(random, 0.55, 1) * most;
      const points = random() < 0.5 ? 0 : 5;
      ctx.fillStyle = pick(random, area.inks.fills);
      at(ctx, area, between(random, 0, w), y, between(random, 0, TAU), () => {
        if (points) star(ctx, 0, 0, 1.5 * r, points, 0.45);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, TAU);
        }
        ctx.strokeStyle = ATLAS_LIGHT;
        ctx.lineWidth = Math.max(2 * EDGE, area.hair);
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.fill();
      });
    }
    return;
  }
  const named = print.collection ? 2 : 1;
  for (let i = named; i < count; i++) {
    const [x, y] = somewhere(area, 2);
    const shape = pick(random, SHAPES);
    const round = shape === 'circle' || shape === 'burst';
    const across = round ? between(random, 14, 30) : 0;
    const [sw, sh] = round
      ? [across, across]
      : shape === 'rounded'
        ? [between(random, 18, 44), between(random, 10, 22)]
        : shape === 'arrow'
          ? [between(random, 22, 38), between(random, 10, 16)]
          : [between(random, 30, 56), between(random, 7, 10)];
    // A word that fits at 80 % of the sticker's largest size, or failing that the shortest.
    const { room, max } = wordRoom(shape, sw, sh);
    const fits = (word: string) => (measured(ctx, word) * 0.8 * max) / 10 <= room;
    let word = pick(random, STICKER_WORDS);
    for (let tries = 0; tries < 5 && !fits(word); tries++) word = pick(random, STICKER_WORDS);
    sticker(ctx, {
      x,
      y,
      turn: between(random, -TURN, TURN),
      shape,
      w: sw,
      h: sh,
      fill: pick(random, fillsOn(area)),
      word: fits(word) ? word : 'CUE',
      points: whole(random, 8, 12),
    });
  }
  const [mine, theirs] = zones(area, named);
  if (print.collection) sticker(ctx, label(ctx, area, theirs, print.collection));
  sticker(ctx, label(ctx, area, mine, print.name.toLocaleUpperCase()));
}

/** Where a tag stands, for its doodles: its centre, slant, length and cap height (mm). */
interface TagPlace {
  readonly x: number;
  readonly y: number;
  readonly slant: number;
  readonly length: number;
  readonly cap: number;
  /** Its letters' centres along it. */
  readonly letters: readonly number[];
}

const SHADOW = 1.5;
const OUTLINE = 1.2;
/** Letters whose foot is at their middle: a drip falls from there, from the others' left stem. */
const CENTRED = 'IJTVY17!';

/**
 * A tag of `text` in `zone`, slanted 10–16° up, in bold caps and four layers: a block shadow
 * 1.5 mm down in the on-accent, a 1.2 mm outline in ATLAS_DARK, the glow's fill and a 0.5 mm inner
 * line in ATLAS_LIGHT; a spray of 30–80 dots under it, and drips from 2–5 of its letters.
 */
function tag(ctx: CanvasRenderingContext2D, area: Area, text: string, zone: Zone): TagPlace {
  const { random, print } = area;
  const { glow, onAccent } = print.light;
  const [zx, zy, zw, zh] = zone;
  const slant = (between(random, 10, 16) * Math.PI) / 180;
  const [cos, sin] = [Math.cos(slant), Math.sin(slant)];
  ctx.font = bold(10);
  const per = ctx.measureText(text).width / 10;
  const size = Math.min(
    28,
    (0.86 * zw) / (per * cos + CAP * sin),
    (0.6 * zh) / (per * sin + CAP * cos),
  );
  ctx.font = bold(size);
  const chars = [...text];
  const length = ctx.measureText(text).width;
  const cap = CAP * size;
  const x = zx + zw / 2 + between(random, -0.04, 0.04) * zw;
  const y = zy + zh * between(random, 0.4, 0.48);
  const lefts = chars.map(
    (_, i) => -length / 2 + ctx.measureText(chars.slice(0, i).join('')).width,
  );
  const widths = chars.map((char) => ctx.measureText(char).width);
  const letters = lefts.map((left, i) => left + widths[i] / 2);
  // The spray first, under the letters: round the tag, just past its outline.
  ctx.fillStyle = area.inks.accent;
  for (let n = whole(random, 30, 80); n > 0; n--) {
    const a = between(random, 0, TAU);
    const out = between(random, 0.75, 1.3);
    const [dx, dy] = [Math.cos(a) * (length / 2 + 2) * out, Math.sin(a) * (cap / 2 + 3) * out];
    dot(ctx, area, x + dx * cos + dy * sin, y - dx * sin + dy * cos, between(random, 0.3, 0.9));
  }
  const drips = shuffled(
    random,
    chars.flatMap((char, i) => (/[\p{L}\p{N}]/u.test(char) ? [i] : [])),
  )
    .slice(0, whole(random, 2, 5))
    .map((i) => {
      const foot = lefts[i] + widths[i] * (CENTRED.includes(chars[i]) ? 0.5 : 0.22);
      return [foot, between(random, 3, 14), between(random, 0.8, 1.4)] as const;
    });
  // "Down" in the tag's own frame, turned back by its slant.
  const [downX, downY] = [-sin, cos];
  const drip = (width: number) => {
    for (const [dx, long, wide] of drips) {
      ctx.lineWidth = lineOf(area, wide) + width;
      ctx.beginPath();
      ctx.moveTo(dx, cap / 2 - 0.6);
      ctx.lineTo(dx + downX * long, cap / 2 - 0.6 + downY * long);
      ctx.stroke();
    }
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-slant);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = onAccent;
  ctx.strokeStyle = onAccent;
  ctx.lineWidth = 2 * OUTLINE;
  for (let d = SHADOW; d > 0.01; d -= SHADOW / 6) {
    ctx.strokeText(text, d, cap / 2 + d);
    ctx.fillText(text, d, cap / 2 + d);
  }
  ctx.strokeStyle = ATLAS_DARK;
  ctx.lineWidth = 2 * OUTLINE;
  ctx.strokeText(text, 0, cap / 2);
  drip(2 * OUTLINE);
  ctx.fillStyle = glow;
  ctx.fillText(text, 0, cap / 2);
  ctx.strokeStyle = ATLAS_LIGHT;
  ctx.lineWidth = lineOf(area, 0.5);
  ctx.strokeText(text, 0, cap / 2);
  // The drips' fill last, over the inner line where they leave their letters.
  ctx.strokeStyle = glow;
  drip(0);
  ctx.restore();
  return { x, y, slant, length, cap, letters };
}

/** 1–3 doodles round a tag, stroked in the accent: a crown, a star, an arrow or a halo. */
function doodles(ctx: CanvasRenderingContext2D, area: Area, place: TagPlace): void {
  const { random } = area;
  const { length, cap, letters } = place;
  const kinds = shuffled(random, ['crown', 'star', 'arrow', 'halo']);
  ctx.save();
  ctx.translate(place.x, place.y);
  ctx.rotate(-place.slant);
  ctx.strokeStyle = area.inks.accent;
  ctx.lineWidth = lineOf(area, 0.9);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const kind of kinds.slice(0, whole(random, 1, 3))) {
    const top = -cap / 2;
    ctx.beginPath();
    if (kind === 'crown') {
      const [cx, c] = [letters[0], 0.9 * cap];
      for (const [px, py] of [
        [-0.5, 0],
        [-0.5, -0.6],
        [-0.25, -0.3],
        [0, -0.7],
        [0.25, -0.3],
        [0.5, -0.6],
        [0.5, 0],
      ]) {
        ctx.lineTo(cx + px * c, top - 0.25 * cap + py * c);
      }
      ctx.closePath();
    } else if (kind === 'halo') {
      ctx.ellipse(letters[letters.length - 1], top - 0.3 * cap, 0.4 * cap, 0.12 * cap, 0, 0, TAU);
    } else if (kind === 'star') {
      star(ctx, length / 2 + 0.6 * cap, top, 0.35 * cap, 5, 0.42);
    } else {
      const y = cap / 2 + 0.5 * cap;
      ctx.moveTo(-length / 2, y);
      ctx.quadraticCurveTo(0, y + 0.45 * cap, length / 2 - 0.2 * cap, y);
      ctx.moveTo(length / 2 - 0.55 * cap, y - 0.2 * cap);
      ctx.lineTo(length / 2 - 0.2 * cap, y);
      ctx.lineTo(length / 2 - 0.5 * cap, y + 0.28 * cap);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Graffiti: on the top and the panels, 1–2 tags of the name and 1–3 doodles round the first; on
 * the rim and the bezel, drips from the outer edge and a spray only, in the accent.
 */
function graffiti(ctx: CanvasRenderingContext2D, area: Area): void {
  const { random, w, h, inks } = area;
  if (closes(area)) {
    ctx.strokeStyle = inks.accent;
    ctx.lineCap = 'round';
    for (let n = Math.round(w / between(random, 9, 16)); n > 0; n--) {
      const long = Math.min(between(random, 3, 14), h - 1.5);
      const wide = between(random, 0.8, 1.4);
      at(ctx, area, between(random, 0, w), long / 2, 0, () => {
        ctx.lineWidth = lineOf(area, wide);
        ctx.beginPath();
        ctx.moveTo(0, -long / 2);
        ctx.lineTo(0, long / 2);
        ctx.stroke();
      });
    }
    ctx.fillStyle = inks.accent;
    for (let n = Math.round(w / between(random, 4, 8)); n > 0; n--) {
      dot(
        ctx,
        area,
        between(random, 0, w),
        between(random, 0.5, h - 0.5),
        between(random, 0.3, 0.9),
      );
    }
    return;
  }
  const text = area.print.name.toLocaleUpperCase();
  const places = zones(area, whole(random, 1, 2)).map((zone) => tag(ctx, area, text, zone));
  doodles(ctx, area, places[0]);
}

const PAINTERS: Readonly<
  Record<PatternStyle, (ctx: CanvasRenderingContext2D, area: Area) => void>
> = { guilloche, circuit, waves, stickers, graffiti };

/**
 * The nameplate: the name in caps, engraved in bold in the metal's line ink over a light edge 1 px
 * below it, as large as fits inside 2 mm margins, its marks included, and centred with them.
 */
function engrave(ctx: CanvasRenderingContext2D, area: Area): void {
  const { w, h, print } = area;
  const caps = print.name.toLocaleUpperCase();
  const { above, below } = reach(caps);
  const largest = Math.min((0.45 * h) / CAP, (h - 4) / (CAP + above + below));
  const { size, text } = fitFont(ctx, bold, caps, w - 4, largest);
  const y = h / 2 + ((CAP + above - below) * size) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ATLAS_LIGHT;
  ctx.fillText(text, w / 2, y + 1 / area.k);
  ctx.fillStyle = inksFor('metal', print).line;
  ctx.fillText(text, w / 2, y);
}

/**
 * The flight case's stencil, over its pattern: its top 40 % cut clear, "PROPERTY OF" and under it
 * the name in caps, light and centred, the name cut across at 52 % of its cap height, a stencil's
 * bridge.
 */
function stencil(ctx: CanvasRenderingContext2D, area: Area): void {
  const { w, h, print } = area;
  const band = STENCIL_BAND * h;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = ATLAS_DARK;
  ctx.fillRect(0, 0, w, band);
  ctx.globalCompositeOperation = 'source-over';
  const small = Math.round(0.06 * h * 100) / 100;
  const caps = print.name.toLocaleUpperCase();
  const { size, text } = fitFont(ctx, bold, caps, 0.86 * w, 0.22 * h, 0.08 * h);
  // The two lines, a gap between them that the name's marks fit, centred in the cleared band.
  const marks = reach(caps);
  const gap = Math.max(0.18, marks.above) * size;
  const block = CAP * small + gap + (CAP + marks.below) * size;
  const ownerLine = (band - block) / 2 + CAP * small;
  const nameLine = ownerLine + gap + CAP * size;
  ctx.fillStyle = ATLAS_LIGHT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = semibold(small);
  ctx.fillText('PROPERTY OF', w / 2, ownerLine);
  ctx.font = bold(size);
  ctx.fillText(text, w / 2, nameLine);
  const wide = ctx.measureText(text).width + 2;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect((w - wide) / 2, nameLine - 0.52 * CAP * size - 0.4, wide, 0.8);
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Paints the atlas for a print: the canvas cleared (transparent is no print), then each region in
 * its clip and its mm, the rim and the bezel flipped so what runs along them reads the right way
 * round: the pattern (none for Plain), the stencil on the case's front, the name on the nameplate.
 */
export function paintDeckPattern(
  canvas: HTMLCanvasElement,
  atlas: DeckAtlas,
  print: PatternPrint,
): void {
  const ctx = context(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const region of atlas.regions) {
    const area = areaOf(region, print);
    ctx.save();
    ctx.beginPath();
    ctx.rect(region.x, region.y, region.w, region.h);
    ctx.clip();
    ctx.translate(region.x, region.y);
    if (region.kind === 'ring' || region.kind === 'band') {
      ctx.translate(0, region.h);
      ctx.scale(1, -1);
    }
    ctx.scale(area.k, area.k);
    if (region.kind === 'nameplate') engrave(ctx, area);
    else {
      if (print.style) PAINTERS[print.style](ctx, area);
      if (region.stencil) stencil(ctx, area);
    }
    ctx.restore();
  }
}
