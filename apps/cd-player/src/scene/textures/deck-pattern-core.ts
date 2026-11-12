// The Deck's print painter: its types, inks, shared helpers, openings, nameplate and stencil (see deck-pattern.ts).
import type { FrameSwatch, LightSwatch } from '../../clear-looks';
import type { PatternStyle } from '../../personal';
import { pxPerMm, type AtlasRegion, type Ground } from './deck-atlas';
import { fitText } from './layout';
import { bold, semibold } from './paint';
import { fnv1a, xorshift } from './xorshift';

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

/** A collection's seed: its `type:id` hashed, so it prints the same on every visit. */
export function collectionSeed(key: string | null): number {
  return fnv1a(key ?? '');
}

/** WCAG 2's relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const v = parseInt(hex.slice(at, at + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The neutral that reads on `fill`: the one of more contrast with it. */
export function inkOn(fill: string): string {
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

export const TAU = Math.PI * 2;
/** Manrope's cap height, per em (measured in Chromium): capitals are centred and cut by it. */
export const CAP = 0.72;
/** How far a capital's marks rise over the cap height (Ẫ's reach 1.14 em) and a dot below falls. */
export const MARKS_ABOVE = 0.42;
export const MARKS_BELOW = 0.2;
export const DOT_BELOW = String.fromCodePoint(0x323);
/** The top's print opens round the jog out to the signature ring (deck_print.py): r 120 mm. */
export const JOG_OPENING = 120;
/** The share of the stencil's region, from its top, that its stencil cuts clear. */
export const STENCIL_BAND = 0.4;

/** What a line of capitals needs over its cap height and under its baseline, per em: its marks. */
export function reach(text: string): { above: number; below: number } {
  const marks = [...text.normalize('NFD')].filter((char) => /\p{M}/u.test(char));
  return {
    above: marks.some((mark) => mark !== DOT_BELOW) ? MARKS_ABOVE : 0,
    below: marks.includes(DOT_BELOW) ? MARKS_BELOW : 0,
  };
}

export type Zone = readonly [x: number, y: number, w: number, h: number];

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
export interface Area {
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

export function areaOf(region: AtlasRegion, print: PatternPrint): Area {
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

export const between = (random: () => number, lo: number, hi: number) => lo + random() * (hi - lo);
export const whole = (random: () => number, lo: number, hi: number) =>
  lo + Math.floor(random() * (hi - lo + 1));
export const pick = <T>(random: () => number, list: readonly T[]): T =>
  list[Math.floor(random() * list.length)];

/** `list` shuffled by the stream (Fisher–Yates: the same order in every engine). */
export function shuffled<T>(random: () => number, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A line `mm` wide, or the thinnest the cut keeps where that is wider. */
export const lineOf = (area: Area, mm: number) => Math.max(mm, area.hair);

/** Whether a region closes on itself along x (the rim, the bezel): its motifs must join there. */
export const closes = (area: Area) => area.region.kind === 'ring' || area.region.kind === 'band';

/** A period near `length` that a closed region's width divides, so a motif joins at its seam. */
export const periodOf = (area: Area, length: number) =>
  closes(area) ? area.w / Math.max(1, Math.round(area.w / length)) : length;

/** The rim's radius (mm) at row y: row 0 is its outer edge once flipped (r_mid ± mmH / 2). */
export const radiusAt = (area: Area, y: number) => area.w / TAU + area.h / 2 - y;

/** How many mm of x one mm along the rim spans at row y (r_mid / r); 1 on a flat region. */
export const along = (area: Area, y: number) =>
  area.region.kind === 'ring' ? area.w / TAU / radiusAt(area, y) : 1;

/** Draws `draw` round (x, y) in true mm, turned `turn`: on the rim, x squeezed as the arc is. */
export function at(
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
export function dot(
  ctx: CanvasRenderingContext2D,
  area: Area,
  x: number,
  y: number,
  r: number,
): void {
  const radius = Math.max(r, 1 / area.k);
  ctx.beginPath();
  ctx.ellipse(x, y, radius * along(area, y), radius, 0, 0, TAU);
  ctx.fill();
}

/** A star's outline round (x, y): `points` points of radius r, its inner radius r · inner. */
export function star(
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
export function rounded(
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
export function fitFont(
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
export function centreOf(area: Area): [number, number] {
  const [cx, cy] = area.region.centre ?? [0, 0];
  return [cx / area.k, cy / area.k];
}

/** How far the region's farthest corner stands from (x, y). */
export const farthest = (area: Area, x: number, y: number) =>
  Math.hypot(Math.max(x, area.w - x), Math.max(y, area.h - y));

/** `n` zones for a region's names and tags (OPEN), the largest halved while there are too few. */
export function zones(area: Area, n: number): Zone[] {
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
 * The nameplate: the name in caps, engraved in bold in the metal's line ink over a light edge 1 px
 * below it, as large as fits inside 2 mm margins, its marks included, and centred with them.
 */
export function engrave(ctx: CanvasRenderingContext2D, area: Area): void {
  const { w, h, print } = area;
  const caps = print.name.toUpperCase();
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
export function stencil(ctx: CanvasRenderingContext2D, area: Area): void {
  const { w, h, print } = area;
  const band = STENCIL_BAND * h;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = ATLAS_DARK;
  ctx.fillRect(0, 0, w, band);
  ctx.globalCompositeOperation = 'source-over';
  const small = Math.round(0.06 * h * 100) / 100;
  const caps = print.name.toUpperCase();
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
