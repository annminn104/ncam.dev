// Stickers, the Deck print's die-cut stickers (see deck-pattern.ts).
import { nameLines } from '../../personal';
import { bold } from './paint';
import {
  ATLAS_LIGHT,
  ATLAS_DARK,
  STICKER_WORDS,
  inkOn,
  TAU,
  CAP,
  STENCIL_BAND,
  type Zone,
  OPEN,
  type Area,
  between,
  whole,
  pick,
  closes,
  at,
  star,
  rounded,
  fitFont,
  zones,
} from './deck-pattern-core';

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
 * the name, or two its parts where it is long (nameLines), each in a zone of its own. The rim and
 * the bezel take small dots and stars only.
 */
export function stickers(ctx: CanvasRenderingContext2D, area: Area): void {
  const { random, w, h, print } = area;
  const parts = nameLines(print.name.toUpperCase());
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
  const named = parts.length + (print.collection ? 1 : 0);
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
  // The name's parts take the best zones, the collection the next; the name's go on top.
  const spots = zones(area, named);
  if (print.collection) sticker(ctx, label(ctx, area, spots[parts.length], print.collection));
  parts.forEach((part, i) => sticker(ctx, label(ctx, area, spots[i], part)));
}
