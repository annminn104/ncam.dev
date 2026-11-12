// Graffiti, the Deck print's tags and doodles (see deck-pattern.ts).
import { bold } from './paint';
import {
  ATLAS_LIGHT,
  ATLAS_DARK,
  TAU,
  CAP,
  type Zone,
  type Area,
  between,
  whole,
  shuffled,
  lineOf,
  closes,
  at,
  dot,
  star,
  zones,
} from './deck-pattern-core';

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
export function graffiti(ctx: CanvasRenderingContext2D, area: Area): void {
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
  const text = area.print.name.toUpperCase();
  const places = zones(area, whole(random, 1, 2)).map((zone) => tag(ctx, area, text, zone));
  doodles(ctx, area, places[0]);
}
