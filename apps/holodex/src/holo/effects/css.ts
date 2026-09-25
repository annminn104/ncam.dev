/**
 * Translating pokemon-cards-151's CSS into this effect DSL, for the Scarlet &
 * Violet effects ported from it (illustration-rare.ts and the six beside it).
 *
 * The v2 effects were derived from pokemon-cards-css by eye, its numbers
 * carried across as they stood: a CSS `200% 700%` became a DSL size of
 * [2, 7], though a CSS size makes the image bigger where a DSL size makes it
 * repeat. These are ports, so the numbers are converted instead. A gradient's
 * angle, stops, background-size and background-position become the DSL's
 * angle, space, size and pointer-driven offset, so the shader samples the
 * colour the reference paints at each point of the card. Where a CSS
 * construct has no exact equivalent, the function says what it does instead,
 * and each effect file lists its own approximations.
 *
 * Coordinates are the shader's: u across and v down the card, both 0..1, as
 * vUv. CSS sizes and positions are fractions of the card: 2 for `200%`.
 *
 * Approximations every port here shares:
 * - Stops the DSL cannot space evenly are resampled to 8, its limit.
 * - A stop's alpha is folded toward the colour its blend leaves unchanged
 *   (see colorAt). That is exact for a blend linear in the layer it applies
 *   to (multiply, screen, overlay, hard-light, soft-light, exclusion) and
 *   close for the rest.
 * - Layers sized in px are converted at CARD_PX.
 * - --seedx/--seedy, the reference's random per-card pattern offsets, are 0:
 *   a card must look the same on every visit.
 */
import { CARD_HEIGHT_OVER_WIDTH } from '../shader/sources';
import type { Filter, GradientStop, Layer, PointerDriven, Source } from '../shader/types';

export type RGB = [number, number, number];

/** A CSS colour stop: `color at%`, with the stop's alpha. */
export interface CssStop {
  color: RGB;
  /** position along the gradient, as a fraction: 0.05 for `5%` */
  at: number;
  alpha: number;
  /** how much of it is the card's glow (uCardGlow): glowStop's 1; the exact gradients only */
  glow?: number;
}

/** A CSS background image as a DSL layer, less the blend its stack gives it. */
export type Background = Omit<Layer, 'blend'>;

/** How an image is sized and placed: its background-size and background-position. */
export interface CssBox {
  /** background-size, as fractions of the card */
  size: [number, number];
  /** background-position, as fractions of the card */
  position: [PointerDriven, PointerDriven];
  /**
   * Whole tiles to move the image by. background-repeat tiles an image
   * smaller than the card or placed off it, so a non-repeating gradient's band
   * can reach the card from a neighbouring tile. The DSL's `linear` has no
   * tiles, so the tile has to be named.
   */
  tile?: [number, number];
}

/** A pointer position, for evaluating a PointerDriven: each term's input. */
export interface PointerAt {
  fromCenter?: number;
  fromLeft?: number;
  fromTop?: number;
}

const MAX_STOPS = 8;

/** The card's width over its height. The reference's --card-aspect rounds it to 0.718. */
export const CARD_ASPECT = 63 / 88;

/**
 * The CSS width assumed for a reference card, in px, to convert the layers
 * the reference sizes in px (a 500px grain, 150px iri tiles). The saved CSS
 * does not fix a card's width; this is an assumption.
 */
export const CARD_PX = 300;

/** A CSS length in px, as a share of the card's width. */
export const pxWide = (px: number): number => px / CARD_PX;
/** A CSS length in px, as a share of the card's height. */
export const pxTall = (px: number): number => (px / CARD_PX) * CARD_ASPECT;

// ------------------------------------------------------------------ colours

/** CSS `hsl(h, s%, l%)` as RGB in 0..1, by CSS Color 4's conversion. */
export function hsl(h: number, s: number, l: number): RGB {
  const hue = ((h % 360) + 360) % 360;
  const light = l / 100;
  const a = (s / 100) * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}

/** CSS `#rrggbb` as RGB in 0..1. */
export function hex(value: string): RGB {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (!match) throw new Error(`not a #rrggbb colour: ${value}`);
  return [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255];
}

export const grey = (value: number): RGB => [value, value, value];
export const BLACK = grey(0);
export const WHITE = grey(1);

/** `color at%`, with alpha as `hsla()` or `transparent` gives it. */
export const stop = (color: RGB, atPercent: number, alpha = 1): CssStop => ({
  color,
  at: atPercent / 100,
  alpha,
});

/** The 151 reference's --sunpillar-1..6 (base.css), paler than pokemon-cards-css's. */
export const SUNPILLAR: RGB[] = [
  hsl(2, 100, 73),
  hsl(53, 100, 69),
  hsl(93, 100, 69),
  hsl(176, 100, 76),
  hsl(228, 100, 74),
  hsl(283, 100, 73),
];

/**
 * --sunpillar-clr-1..6, which base.css rotates per element: `.card__shine`
 * starts them at --sunpillar-1, its `:before` at --sunpillar-5 and its
 * `:after` at --sunpillar-6.
 */
export function sunpillarClr(first: 1 | 5 | 6): RGB[] {
  return SUNPILLAR.map((_, i) => SUNPILLAR[(first - 1 + i) % SUNPILLAR.length]);
}

/**
 * `repeating-linear-gradient(0deg, var(--sunpillar-clr-1) calc(var(--space)*1),
 * … var(--sunpillar-clr-1) calc(var(--space)*7))` at --space 5%, as
 * illustration-rare, ex-regular and ex-full-art all write it.
 */
export function sunpillarStops(clr: RGB[]): CssStop[] {
  return [...clr.map((color, i) => stop(color, 5 * (i + 1))), stop(clr[0], 35)];
}

/** `var(--sunpillar)`: --sunpillar-1 at 25% to --sunpillar-6 at 75%, the four between spread evenly. */
export const SUNPILLAR_VAR: CssStop[] = SUNPILLAR.map((color, i) => stop(color, 25 + 10 * i));

/**
 * The faint dark radial illustration-rare, ex-regular and ex-full-art put
 * beneath their bands: black at 10%, 15%, then 25% alpha.
 */
export const DARK_RADIAL: CssStop[] = [
  stop(BLACK, 12, 0.1),
  stop(BLACK, 20, 0.15),
  stop(BLACK, 120, 0.25),
];

// ----------------------------------------------------- pointer-driven values

const TERMS = ['fromCenter', 'fromLeft', 'fromTop'] as const;

export const fixed = (fraction: number): PointerDriven => ({ base: fraction });
export const CENTER = fixed(0.5);

/** --pointer-x / --pointer-y: the pointer's position across and down the card, 0..1. */
export const POINTER_X: PointerDriven = { base: 0, fromLeft: 1 };
export const POINTER_Y: PointerDriven = { base: 0, fromTop: 1 };

/**
 * --background-x / --background-y. No CSS sets them: the reference's
 * Card.svelte does, mapping the pointer into 37%..63% across and 33%..67%
 * down (`adjust(percent.x, 0, 100, 37, 63)` and `adjust(percent.y, 0, 100,
 * 33, 67)`), as pokemon-cards-css's does.
 */
export const BACKGROUND_X: PointerDriven = { base: 0.37, fromLeft: 0.26 };
export const BACKGROUND_Y: PointerDriven = { base: 0.33, fromTop: 0.34 };
/** `background-position: var(--background-x) var(--background-y)` */
export const AT_BACKGROUND: [PointerDriven, PointerDriven] = [BACKGROUND_X, BACKGROUND_Y];

/** background-size `cover` on a gradient, placed at `center`: the card, exactly. */
export const COVER: CssBox = { size: [1, 1], position: [CENTER, CENTER] };

/** `p * k` */
export function times(p: PointerDriven, k: number): PointerDriven {
  const out: PointerDriven = { base: p.base * k };
  for (const term of TERMS) {
    const value = (p[term] ?? 0) * k;
    if (value !== 0) out[term] = value;
  }
  return out;
}

/** `p + q` */
export function plus(p: PointerDriven, q: PointerDriven): PointerDriven {
  const out: PointerDriven = { base: p.base + q.base };
  for (const term of TERMS) {
    const value = (p[term] ?? 0) + (q[term] ?? 0);
    if (value !== 0) out[term] = value;
  }
  return out;
}

/** A pointer-driven number's value at a pointer position. */
export function valueAt(p: PointerDriven | undefined, at: PointerAt = {}, fallback = 1): number {
  if (!p) return fallback;
  return TERMS.reduce((sum, term) => sum + (p[term] ?? 0) * (at[term] ?? 0), p.base);
}

// ----------------------------------------------------------------- gradients

/** A number linear in the card's uv: a·u + b·v + c, where c may follow the pointer. */
interface Linear {
  a: number;
  b: number;
  c: PointerDriven;
}

/**
 * How far along a CSS linear gradient's line each point of the card falls: 0
 * where the line starts, 1 where it ends. CSS draws the line through the
 * image's centre at the gradient's angle (0deg points up, 90deg right), just
 * long enough that the perpendiculars through two opposite corners are its
 * ends; background-position lines the image's p% point up with the card's.
 */
function gradientLine(angleDeg: number, box: CssBox): Linear {
  const width = CARD_ASPECT; // in card heights
  const imageWidth = box.size[0] * width;
  const imageHeight = box.size[1];
  const rad = (angleDeg * Math.PI) / 180;
  // the line's direction, y down
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const length = Math.abs(imageWidth * dx) + Math.abs(imageHeight * dy);
  const [tileX, tileY] = box.tile ?? [0, 0];
  const left = plus(times(box.position[0], width - imageWidth), fixed(tileX * imageWidth));
  const top = plus(times(box.position[1], 1 - imageHeight), fixed(tileY * imageHeight));
  // s = ((x - left - imageWidth / 2) dx + (y - top - imageHeight / 2) dy) / length + 1/2,
  // at x = u * width, y = v
  return {
    a: (width * dx) / length,
    b: dy / length,
    c: plus(
      plus(times(left, -dx / length), times(top, -dy / length)),
      fixed(0.5 - ((imageWidth / 2) * dx + (imageHeight / 2) * dy) / length),
    ),
  };
}

/** (s - from) / span, still linear in uv */
function along(line: Linear, from: number, span: number): Linear {
  return { a: line.a / span, b: line.b / span, c: times(plus(line.c, fixed(-from)), 1 / span) };
}

const mix = (x: RGB, y: RGB, f: number): RGB => [
  x[0] + (y[0] - x[0]) * f,
  x[1] + (y[1] - x[1]) * f,
  x[2] + (y[2] - x[2]) * f,
];

const luma = (c: RGB) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

/**
 * A stop's colour with its alpha folded in, as the opaque colour the layer's
 * blend must see there: `neutral` (the colour that blend leaves unchanged)
 * where the stop is transparent, its own colour where it is opaque. CSS
 * interpolates gradients premultiplied, which is linear in the alpha and the
 * alpha-weighted colour, and so in these folded colours too.
 */
function opaque(s: CssStop, neutral: RGB | undefined): RGB {
  if (s.alpha === 1) return s.color;
  if (!neutral) throw new Error('a stop with alpha needs the neutral colour its blend ignores');
  return mix(neutral, s.color, s.alpha);
}

/**
 * A CSS gradient's colour at `s` along it: its first colour before the first
 * stop, its last after the last, linear between.
 */
export function colorAt(stops: CssStop[], s: number, neutral?: RGB): RGB {
  if (s <= stops[0].at) return opaque(stops[0], neutral);
  for (let i = 1; i < stops.length; i += 1) {
    const [from, to] = [stops[i - 1], stops[i]];
    if (s <= to.at) {
      const f = to.at === from.at ? 1 : (s - from.at) / (to.at - from.at);
      return mix(opaque(from, neutral), opaque(to, neutral), f);
    }
  }
  return opaque(stops[stops.length - 1], neutral);
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const sameColor = (a: RGB, b: RGB) => a.every((v, i) => near(v, b[i]));

/**
 * One period of a repeating gradient as the DSL's evenly spaced stops, which
 * wrap from the last back to the first. A period whose stops are already
 * even, and end on the colour they start with, is used as it stands.
 * Otherwise it is resampled at 8 even points, one of them on the brightest
 * stop so a narrow band keeps its peak. Resampling widens that peak.
 */
function period(stops: CssStop[]): { colors: RGB[]; from: number; span: number } {
  if (stops.some((s) => s.alpha !== 1)) throw new Error('a repeating gradient here is opaque');
  const first = stops[0].at;
  const span = stops[stops.length - 1].at - first;
  const even = stops.every((s, i) => near(s.at, first + (span * i) / (stops.length - 1)));
  const closed = sameColor(stops[0].color, stops[stops.length - 1].color);
  if (even && closed && stops.length - 1 <= MAX_STOPS) {
    return { colors: stops.slice(0, -1).map((s) => s.color), from: first, span };
  }
  const step = span / MAX_STOPS;
  const peak = stops.reduce((best, s) => (luma(s.color) > luma(best.color) ? s : best));
  const from = first + ((((peak.at - first) % step) + step) % step);
  const colors = Array.from({ length: MAX_STOPS }, (_, i) => {
    const s = from + i * step;
    return colorAt(stops, first + ((s - first) % span));
  });
  return { colors, from, span };
}

const degrees = (rad: number) => (rad * 180) / Math.PI;

/**
 * `repeating-linear-gradient(<angle>deg, stops)` in an image of this box, as
 * a `repeating-linear` layer: the same colour at every point of the card.
 */
export function repeatingLinear(angleDeg: number, stops: CssStop[], box: CssBox): Background {
  const { colors, from, span } = period(stops);
  const t = along(gradientLine(angleDeg, box), from, span);
  const dir = Math.atan2(t.b, t.a);
  const space = 1 / Math.hypot(t.a, t.b);
  // whole periods change nothing
  const c = { ...t.c, base: t.c.base - Math.floor(t.c.base) };
  return {
    source: { kind: 'repeating-linear', angleDeg: degrees(dir), space, stops: colors },
    size: [1, 1],
    offset: { x: times(c, space * Math.cos(dir)), y: times(c, space * Math.sin(dir)) },
  };
}

/**
 * `linear-gradient(<angle>deg, stops)` in an image of this box, as a `linear`
 * layer, whose stops span its first CSS stop to its last and hold their end
 * colours beyond. Uneven stops are resampled at 8 even points, exactly when
 * they fall on that grid. For the same image tiled, see CssBox.tile.
 */
export function linear(angleDeg: number, stops: CssStop[], box: CssBox): Background {
  if (stops.some((s) => s.alpha !== 1)) throw new Error('a linear gradient here is opaque');
  const first = stops[0].at;
  const span = stops[stops.length - 1].at - first;
  const even = stops.every((s, i) => near(s.at, first + (span * i) / (stops.length - 1)));
  const colors =
    even && stops.length <= MAX_STOPS
      ? stops.map((s) => s.color)
      : Array.from({ length: MAX_STOPS }, (_, i) =>
          colorAt(stops, first + (span * i) / (MAX_STOPS - 1)),
        );
  const t = along(gradientLine(angleDeg, box), first, span);
  const dir = Math.atan2(t.b, t.a);
  const k = Math.hypot(t.a, t.b);
  return {
    source: { kind: 'linear', angleDeg: degrees(dir), stops: colors },
    size: [k, k],
    offset: { x: times(t.c, Math.cos(dir)), y: times(t.c, Math.sin(dir)) },
  };
}

/** Stop positions for a radial: the fewest even ones (2..8) its CSS stops fall on, else 8. */
function radialSamples(stops: CssStop[]): number[] {
  const grid = (n: number) => Array.from({ length: n }, (_, i) => i / (n - 1));
  for (let n = 2; n < MAX_STOPS; n += 1) {
    const fits = stops.every(
      (s) => s.at <= 0 || s.at >= 1 || near(s.at * (n - 1), Math.round(s.at * (n - 1))),
    );
    if (fits) return grid(n);
  }
  return grid(MAX_STOPS);
}

/**
 * `radial-gradient(farthest-corner circle at var(--pointer-x) var(--pointer-y),
 * stops)` in an image of this box, as a `radial-pointer` layer drawn with
 * CSS's own geometry (the Source's cssBox): centred at the pointer's fraction
 * of the image as background-position places it, and reaching out to the
 * image's farthest corner, so it grows as the pointer leaves the middle. Stops
 * with alpha need `neutral`: see colorAt.
 */
export function radial(stops: CssStop[], box: CssBox = COVER, neutral?: RGB): Background {
  const [width, height] = box.size;
  // the image's left and top edges, plus the pointer's fraction of its size
  const centreX = plus(times(box.position[0], 1 - width), times(POINTER_X, width));
  const centreY = plus(times(box.position[1], 1 - height), times(POINTER_Y, height));
  return {
    source: {
      kind: 'radial-pointer',
      stops: radialSamples(stops).map((at) => ({ at, color: colorAt(stops, at, neutral) })),
      cssBox: { centre: [centreX, centreY], size: [width, height] },
    },
  };
}

/**
 * How far along a converted radial (radial above) a point of the card lies, 0
 * at its centre and 1 at its radius: sources.ts's radialCssDistance, in
 * TypeScript, so a test can hold a layer to CSS's geometry and the GLSL to
 * this.
 */
export function radialT(layer: Background, uv: [number, number], at: PointerAt = {}): number {
  const s = layer.source;
  if (s.kind !== 'radial-pointer' || !s.cssBox) {
    throw new Error('not a radial converted with CSS geometry');
  }
  const [px, py] = [at.fromLeft ?? 0, at.fromTop ?? 0];
  const [cx, cy] = s.cssBox.centre.map((p) => valueAt(p, at, 0));
  const [w, h] = s.cssBox.size;
  const rx = w * Math.max(px, 1 - px);
  const ry = h * Math.max(py, 1 - py) * CARD_HEIGHT_OVER_WIDTH;
  const dx = uv[0] - cx;
  const dy = (uv[1] - cy) * CARD_HEIGHT_OVER_WIDTH;
  return Math.min(1, Math.max(0, Math.hypot(dx, dy) / Math.hypot(rx, ry)));
}

// ------------------------------------------------------- exact gradients

/** How many stops an exact gradient holds (sources.ts's MAX_CSS_STOPS). */
export const MAX_CSS_STOPS = 32;

/**
 * sources.ts's radialReach: how far out along a CSS radial a point of the
 * card lies, in radii, unclamped. `centre` is on the card, `size` its
 * image's, `at` the centre's fraction of that image, which CSS measures the
 * farthest corner from. A circle reaches that corner; an ellipse keeps
 * farthest-side's aspect and grows by √2 to pass through it. Lengths are in
 * card widths.
 */
export function reach(
  centre: [number, number],
  size: [number, number],
  at: [number, number],
  ellipse: boolean,
  uv: [number, number],
): number {
  const sideX = size[0] * Math.max(at[0], 1 - at[0]);
  const sideY = size[1] * Math.max(at[1], 1 - at[1]) * CARD_HEIGHT_OVER_WIDTH;
  const dx = uv[0] - centre[0];
  const dy = (uv[1] - centre[1]) * CARD_HEIGHT_OVER_WIDTH;
  return ellipse
    ? Math.hypot(dx / sideX, dy / sideY) / Math.SQRT2
    : Math.hypot(dx, dy) / Math.hypot(sideX, sideY);
}

/**
 * sources.ts's conicTurn: where a point falls around a CSS conic, in turns
 * clockwise from `from` (itself in turns from the top), measured in the
 * card's true proportions as CSS measures a conic's angle.
 */
export function turn(centre: [number, number], from: number, uv: [number, number]): number {
  const dx = uv[0] - centre[0];
  const dy = (uv[1] - centre[1]) * CARD_HEIGHT_OVER_WIDTH;
  const t = Math.atan2(dx, -dy) / (2 * Math.PI) - from;
  return t - Math.floor(t);
}

/**
 * sources.ts's cssStopIndex: t's place among stops at these positions, in
 * stop indices — 0 at or before the first, the last index at or after the
 * last, fractional between two, and past a hard edge (two stops at one
 * place) at once. CSS's own lookup.
 */
export function cssStopIndex(pos: readonly number[], t: number): number {
  let index = 0;
  for (let i = 1; i < pos.length; i += 1) {
    if (t <= pos[i - 1]) break;
    const span = pos[i] - pos[i - 1];
    index = t >= pos[i] ? i : i - 1 + (t - pos[i - 1]) / span;
  }
  return index;
}

/** `var(--card-glow) at%`: a stop that is all the card's glow (uCardGlow). */
export const glowStop = (atPercent: number, alpha = 1): CssStop => ({
  color: BLACK,
  at: atPercent / 100,
  alpha,
  glow: 1,
});

/**
 * CSS stops as an exact gradient's: where CSS puts them (a stop placed before
 * an earlier one moves up to it, as CSS moves it), alpha and glow kept,
 * optionally mapped to another scale.
 */
function exactStops(stops: CssStop[], place: (at: number) => number = (at) => at): GradientStop[] {
  let floor = -Infinity;
  return stops.map((s) => {
    floor = Math.max(floor, s.at);
    const out: GradientStop = { at: place(floor), color: s.color };
    if (s.alpha !== 1) out.alpha = s.alpha;
    if (s.glow) out.glow = s.glow;
    return out;
  });
}

/** `linear-gradient(<angle>deg, stops)` in an image of this box, drawn exactly (the RGBA path). */
export function exactLinear(angleDeg: number, stops: CssStop[], box: CssBox = COVER): Background {
  const line = gradientLine(angleDeg, box);
  return { source: { kind: 'css-linear', repeating: false, line, stops: exactStops(stops) } };
}

/**
 * `repeating-linear-gradient(<angle>deg, stops)` in an image of this box,
 * drawn exactly: one period, first stop to last, normalised to 0..1, which
 * the shader wraps t into, as CSS repeats the stops.
 */
export function exactRepeatingLinear(
  angleDeg: number,
  stops: CssStop[],
  box: CssBox = COVER,
): Background {
  const first = stops[0].at;
  const span = stops[stops.length - 1].at - first;
  if (!(span > 0)) throw new Error('a repeating gradient needs a period');
  const line = along(gradientLine(angleDeg, box), first, span);
  const period = exactStops(stops, (at) => (at - first) / span);
  return { source: { kind: 'css-linear', repeating: true, line, stops: period } };
}

/**
 * `radial-gradient(farthest-corner <circle|ellipse> at <at>, stops)` in an
 * image of this box, drawn exactly: centred at `at` of the image (the
 * pointer, unless given), as background-position places the image. An image
 * smaller than the card would tile, which this does not draw.
 */
export function exactRadial(
  stops: CssStop[],
  box: CssBox = COVER,
  options: { at?: [PointerDriven, PointerDriven]; ellipse?: boolean } = {},
): Background {
  const [width, height] = box.size;
  if (width < 1 || height < 1) throw new Error('a radial smaller than the card would tile');
  const at = options.at ?? [POINTER_X, POINTER_Y];
  return {
    source: {
      kind: 'css-radial',
      centre: [
        plus(times(box.position[0], 1 - width), times(at[0], width)),
        plus(times(box.position[1], 1 - height), times(at[1], height)),
      ],
      size: [width, height],
      at,
      ellipse: options.ellipse ?? false,
      stops: exactStops(stops),
    },
  };
}

/** `conic-gradient([from <turns>,] stops)` over the whole card, about its centre, drawn exactly. */
export function exactConic(stops: CssStop[], options: { from?: number } = {}): Background {
  return {
    source: {
      kind: 'css-conic',
      centre: [0.5, 0.5],
      from: options.from ?? 0,
      stops: exactStops(stops),
    },
  };
}

/** A gradient line's length in px at CARD_PX, for stops the CSS places in px. */
export function gradientLengthPx(angleDeg: number, box: CssBox): number {
  const rad = (angleDeg * Math.PI) / 180;
  const width = box.size[0] * CARD_PX;
  const height = (box.size[1] * CARD_PX) / CARD_ASPECT;
  return Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad));
}

/** background-size `<width> auto` for a texture of this natural size, as fractions of the card. */
export function autoHeight(width: number, natural: readonly [number, number]): [number, number] {
  return [width, width * (natural[1] / natural[0]) * CARD_ASPECT];
}

/**
 * An exact gradient's colour at t, as sources.ts's cssStops draws it: the
 * stops premultiplied (a glow mixed in first), straight colour and alpha out.
 */
export function exactColorAt(
  stops: GradientStop[],
  t: number,
  glow: RGB = BLACK,
): [number, number, number, number] {
  const index = cssStopIndex(
    stops.map((s) => s.at),
    t,
  );
  const i = Math.floor(index);
  const j = Math.min(i + 1, stops.length - 1);
  const premul = (s: GradientStop) => {
    const a = s.alpha ?? 1;
    const c = mix(s.color, glow, s.glow ?? 0);
    return [c[0] * a, c[1] * a, c[2] * a, a];
  };
  const [p, q] = [premul(stops[i]), premul(stops[j])];
  const m = p.map((v, k) => v + (q[k] - v) * (index - i));
  return m[3] > 0 ? [m[0] / m[3], m[1] / m[3], m[2] / m[3], m[3]] : [0, 0, 0, 0];
}

type TextureKind = Extract<Source, { scale: number }>['kind'];

/**
 * A tiled texture in an image of this box. The DSL samples a texture across
 * the card at uv·size + offset, so the image's own 0..1, (u - left) / width
 * with left = (1 - width) · position, is a size of 1/width and an offset of
 * (width - 1) · position / width.
 */
export function texture(kind: TextureKind, box: CssBox): Background {
  const [width, height] = box.size;
  return {
    source: { kind, scale: 1 },
    size: [1 / width, 1 / height],
    offset: {
      x: times(box.position[0], (width - 1) / width),
      y: times(box.position[1], (height - 1) / height),
    },
  };
}

/** A layer moved by half a tile each way, so two samplings of one texture do not line up. */
export function halfTile(layer: Background): Background {
  const offset = layer.offset ?? { x: fixed(0), y: fixed(0) };
  return { ...layer, offset: { x: plus(offset.x, CENTER), y: plus(offset.y, CENTER) } };
}

/**
 * The DSL's gradient parameter for a `linear` or `repeating-linear` layer at
 * a point of the card, before its fract() or clamp(): sources.ts's
 * arithmetic, in TypeScript, so a test can hold a converted layer to the CSS
 * it came from.
 */
export function gradientT(layer: Background, uv: [number, number], at: PointerAt = {}): number {
  const s = layer.source;
  if (s.kind !== 'linear' && s.kind !== 'repeating-linear') {
    throw new Error(`${s.kind} is not a linear gradient`);
  }
  const size = layer.size ?? [1, 1];
  const u = uv[0] * size[0] + valueAt(layer.offset?.x, at, 0);
  const v = uv[1] * size[1] + valueAt(layer.offset?.y, at, 0);
  const rad = (s.angleDeg * Math.PI) / 180;
  const projected = u * Math.cos(rad) + v * Math.sin(rad);
  return s.kind === 'repeating-linear' ? projected / Math.max(s.space, 1e-4) : projected;
}

/** A gradient layer with every stop's colour mapped. */
export function mapStops(layer: Background, fn: (c: RGB) => RGB): Background {
  const s = layer.source;
  switch (s.kind) {
    case 'repeating-linear':
      return { ...layer, source: { ...s, stops: s.stops.map(fn) } };
    case 'linear':
      return { ...layer, source: { ...s, stops: s.stops.map(fn) } };
    case 'radial-pointer':
      return {
        ...layer,
        source: { ...s, stops: s.stops.map((st) => ({ ...st, color: fn(st.color) })) },
      };
    default:
      throw new Error(`${s.kind} has no stops`);
  }
}

// ------------------------------------------------------------------- filters

/** A CSS filter whose values do not follow the pointer. */
export interface FixedFilter {
  brightness?: number;
  contrast?: number;
  saturate?: number;
}

/** The DSL filter for a fixed CSS one. */
export function fixedFilter(f: FixedFilter): Filter {
  return {
    brightness: fixed(f.brightness ?? 1),
    contrast: fixed(f.contrast ?? 1),
    saturate: fixed(f.saturate ?? 1),
  };
}

/**
 * The shader's applyFilter (shader/sources.ts) in TypeScript: brightness,
 * contrast, then saturate about Rec. 601 luma, clamped once at the end.
 */
export function filterRGB(c: RGB, f: FixedFilter): RGB {
  const b = f.brightness ?? 1;
  const k = f.contrast ?? 1;
  const y = c.map((v) => (v * b - 0.5) * k + 0.5) as RGB;
  const l = luma(y);
  return y.map((v) => Math.min(1, Math.max(0, l + (v - l) * (f.saturate ?? 1)))) as RGB;
}

/**
 * CSS's filter chain as Chrome applies it to an element (sources.ts's
 * applyCssFilter, the RGBA path's filter): brightness, then contrast, each
 * clamped, then saturate about CSS's own luma (0.213, 0.715, 0.072), clamped.
 * css.test.ts holds it to Chrome's readings. filterRGB above is the RGB path's
 * older model, which clamps once and saturates about Rec. 601 luma.
 */
export function cssFilterRGB(c: RGB, f: FixedFilter): RGB {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const b = f.brightness ?? 1;
  const k = f.contrast ?? 1;
  const bright = c.map((v) => clamp01(v * b));
  const contrasted = bright.map((v) => clamp01((v - 0.5) * k + 0.5));
  const l = 0.213 * contrasted[0] + 0.715 * contrasted[1] + 0.072 * contrasted[2];
  return contrasted.map((v) => clamp01(l + (v - l) * (f.saturate ?? 1))) as RGB;
}

/**
 * A fixed filter baked into a gradient's stops. Exact wherever the filter
 * does not clamp between two stops, since brightness, contrast and saturate
 * are linear and so commute with the interpolation between them.
 */
export function filtered(layer: Background, f: FixedFilter): Background {
  return mapStops(layer, (c) => filterRGB(c, f));
}

/**
 * One filter equal to `inner`, then `outer`. Brightness and contrast make one
 * affine map per channel, and saturate commutes with it, so two filters
 * compose into one exactly but for the clamp CSS applies between them. A
 * brightness on --pointer-from-center makes the product quadratic in it; the
 * result is exact where that is 0 or 1 (the centre, and from the middle of an
 * edge outward) and linear between.
 */
export function composeFilters(inner: Filter, outer: Filter): Filter {
  const parts = [inner.brightness, inner.contrast, inner.saturate];
  const more = [outer.brightness, outer.contrast, outer.saturate];
  if ([...parts, ...more].some((p) => p && (p.fromLeft || p.fromTop))) {
    throw new Error('only --pointer-from-center composes');
  }
  const at = (fromCenter: number) => {
    const [b1, c1, s1] = parts.map((p) => valueAt(p, { fromCenter }));
    const [b2, c2, s2] = more.map((p) => valueAt(p, { fromCenter }));
    // x -> gain * x + lift, which is brightness b then contrast c for
    // b * c = gain and (1 - c) / 2 = lift
    const gain = b1 * c1 * b2 * c2;
    const lift = 0.5 * b2 * c2 * (1 - c1) + 0.5 * (1 - c2);
    const contrast = 1 - 2 * lift;
    return [gain / contrast, contrast, s1 * s2];
  };
  const [lo, hi] = [at(0), at(1)];
  const drive = (i: number): PointerDriven =>
    near(lo[i], hi[i]) ? fixed(lo[i]) : { base: lo[i], fromCenter: hi[i] - lo[i] };
  return { brightness: drive(0), contrast: drive(1), saturate: drive(2) };
}

/**
 * The grey an element's filter turns into `target`: what a pixel masked out of
 * it must be before the filter, for its blend to see `target` after.
 */
export function neutralBefore(f: FixedFilter, target: number): number {
  return ((target - 0.5) / (f.contrast ?? 1) + 0.5) / (f.brightness ?? 1);
}

// -------------------------------------------------------- stand-in layers

/**
 * x → min(1, scale · x + offset), as two solid layers: a multiply, then a
 * plus-lighter. The DSL's filter only runs after a whole stack, so an affine
 * step the reference takes partway up one, such as a pseudo-element's own
 * `contrast()` before it blends into its parent, has to be spelt as layers.
 * `contrast(c)` for c ≤ 1 is affineLayers(c, (1 - c) / 2).
 */
export function affineLayers(scale: number, offset: number): Layer[] {
  return [
    { source: { kind: 'solid', color: grey(scale) }, blend: 'multiply' },
    { source: { kind: 'solid', color: grey(offset) }, blend: 'plus-lighter' },
  ];
}

/**
 * A radial CSS alpha mask (`mask-mode: alpha`), as layers on top of an
 * element's stack. The DSL has no alpha. Multiplying by the mask, then adding
 * `neutral` · (1 - mask) back, turns each pixel the mask hides into
 * `neutral`: the grey the element's mix-blend-mode leaves the card unchanged
 * by, as it stands before the element's filter (see neutralBefore). With a
 * black neutral the second layer would add nothing, so it is left off.
 */
export function radialMask(stops: CssStop[], neutral: number, box: CssBox = COVER): Layer[] {
  const alphas = (value: (alpha: number) => number) =>
    stops.map((s) => ({ ...s, color: grey(value(s.alpha)), alpha: 1 }));
  const kept = alphas((a) => a);
  const keep: Layer = { ...radial(kept, box), blend: 'multiply' };
  if (neutral === 0) return [keep];
  const added = alphas((a) => neutral * (1 - a));
  return [keep, { ...radial(added, box), blend: 'plus-lighter' }];
}
