/**
 * The generated textures the foil layers sample; scene.ts shares each one
 * across every effect that names it. All of them are drawn here at runtime.
 * Nothing is fetched, and none is a copy of the reference's own foil images,
 * which are their author's assets.
 *
 * The two older textures, glitter and grain, draw with Math.random and so
 * differ a little on every load. The six added for the Scarlet & Violet
 * effects are fixed: iri and birthday draw from a seeded PRNG, and the ball
 * patterns are a regular lattice with no randomness in them at all, so a card
 * looks the same on every visit.
 *
 * Tests run under node with no DOM, so the canvas painters at the bottom of
 * this file cannot run there. What they paint is decided by the pure functions
 * above them, which textures.test.ts holds to account: the PRNG, iri's pixels
 * (the whole texture, byte for byte), the star's shape, sizes and colours, the
 * ball lattice, and the wrapping that makes each texture tile. Left untested:
 * the canvas calls themselves, and the ball glyphs' internal drawing.
 */

export type TextureName =
  | 'glitter'
  | 'grain'
  | 'iri'
  | 'birthday'
  | 'pokeball'
  | 'pokeball-inner'
  | 'masterball'
  | 'masterball-inner';

type Point = [number, number];

// ------------------------------------------------------------- pure, tested

/**
 * mulberry32, a small seeded PRNG, uniform in [0, 1). The same seed gives the
 * same sequence on every load and in every engine (Math.imul and the integer
 * shifts are exact), which is all it is for. Not for anything cryptographic.
 */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The tile offsets a shape centred on (x, y) and reaching `reach` each way has
 * to be drawn at for the texture to tile seamlessly: where it is, plus one
 * tile over for each edge it crosses, and diagonally when it crosses a corner.
 * Without the copies, whatever pokes past an edge is cut off, and the repeat
 * shows a seam.
 */
export function wrapOffsets(
  x: number,
  y: number,
  reach: number,
  width: number,
  height: number,
): Point[] {
  const dxs = [0];
  if (x - reach < 0) dxs.push(width);
  if (x + reach > width) dxs.push(-width);
  const dys = [0];
  if (y - reach < 0) dys.push(height);
  if (y + reach > height) dys.push(-height);
  return dxs.flatMap((dx) => dys.map((dy): Point => [dx, dy]));
}

/** CSS Color 4's HSL-to-RGB, as bytes: h in degrees, s and l in 0..1. */
function hslBytes(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [channel(0), channel(8), channel(4)];
}

// iri: the reference's iri-8 is a 300px tile of single-pixel dots over about
// a seventh of a dark slate-violet ground.

export const IRI_SIZE = 300;
/** Any fixed value. Changing it redraws every card's speckle. */
export const IRI_SEED = 151;
export const IRI_BACKGROUND = [47, 45, 55] as const;
/** Dots per pixel. Some land on the same pixel, so a little under this is lit. */
const IRI_DENSITY = 0.15;

/**
 * One speckle's colour. Like the reference's: mostly pale dots with a lavender
 * cast, then a faintly saturated violet, then a little blue, none of them far
 * from grey (nine in ten of the reference's are within 32 of it, in 0..255);
 * most of them dim, a bright few.
 */
function iriColor(random: () => number): [number, number, number] {
  const family = random();
  const lightness = 0.52 + 0.36 * random() ** 2;
  if (family < 0.55) return hslBytes(235 + 35 * random(), 0.02 + 0.07 * random(), lightness);
  if (family < 0.88) return hslBytes(255 + 25 * random(), 0.08 + 0.16 * random() ** 1.5, lightness);
  return hslBytes(205 + 25 * random(), 0.08 + 0.12 * random(), lightness);
}

/** The whole iri texture as opaque RGBA bytes, ready for putImageData. */
export function iriPixels(size: number, seed: number): Uint8ClampedArray {
  const random = mulberry32(seed);
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = IRI_BACKGROUND[0];
    pixels[i + 1] = IRI_BACKGROUND[1];
    pixels[i + 2] = IRI_BACKGROUND[2];
    pixels[i + 3] = 255;
  }
  const dots = Math.round(IRI_DENSITY * size * size);
  for (let n = 0; n < dots; n += 1) {
    // Whole pixels, so each dot is one crisp pixel rather than an
    // antialiased smudge across four.
    const at = (Math.floor(random() * size) + Math.floor(random() * size) * size) * 4;
    const [r, g, b] = iriColor(random);
    pixels[at] = r;
    pixels[at + 1] = g;
    pixels[at + 2] = b;
  }
  return pixels;
}

// birthday: the reference's birthday-holo-dank is about 1,800 rainbow
// sparkles on near-black. Ours is drawn in the card's own 63:88, so a star
// drawn square stays square on the card.

export const BIRTHDAY_WIDTH = 882;
export const BIRTHDAY_HEIGHT = 1232;
/** Any fixed value. Changing it redraws every card's stars. */
export const BIRTHDAY_SEED = 25;
const BIRTHDAY_COUNT = 1800;
const BIRTHDAY_BACKGROUND = 'rgb(16, 16, 15)';
/**
 * A star's half-height, as a share of the sheet's height: log-normal, so most
 * are specks and a few are large. Measured off the reference, whose star sizes
 * fit a log-normal with a spread of about 0.7.
 */
const ARM = { median: 0.00275, spread: 0.75, min: 0.00075, max: 0.025 };
/** The side rays' reach, and every ray's half-width, against the vertical rays. */
const STAR = { across: 0.8, waist: 0.22 };
/** How far one star's hue may stray from the sheet's colour field, as a share of the spectrum. */
const HUE_JITTER = 0.5;

export interface Sparkle {
  x: number;
  y: number;
  /** half the star's height: its vertical rays, the longer pair */
  arm: number;
  /** degrees */
  hue: number;
  /** 0..1 */
  saturation: number;
  /** 0..1 */
  lightness: number;
}

/**
 * The hue, in degrees, of a star at (u, v) in 0..1 tile space. A rainbow
 * sweeps the sheet diagonally with a wobble, so neighbouring stars share a
 * colour the way patches of a holographic sheet do (in the reference,
 * neighbours differ by about 60° on average, where any two stars differ by
 * 90°), and `jitter`, in -0.5..0.5, scatters each star off it. The spectrum
 * runs red through violet and never reaches magenta, which the reference's
 * never does either. Every term is periodic in u and v, so the colours line up
 * across the tile's edges.
 */
export function birthdayHue(u: number, v: number, jitter: number): number {
  const t = u + v + 0.12 * Math.sin(2 * Math.PI * (2 * u - v)) + HUE_JITTER * jitter;
  return (330 + 300 * (t - Math.floor(t))) % 360;
}

/**
 * A four-pointed star as two thin diamonds crossed: a tall one, and a wide one
 * whose rays reach a little less far.
 */
export function starDiamonds(star: Pick<Sparkle, 'x' | 'y' | 'arm'>): [Point[], Point[]] {
  const { x, y, arm } = star;
  const across = arm * STAR.across;
  const waist = arm * STAR.waist;
  return [
    [
      [x, y - arm],
      [x + waist, y],
      [x, y + arm],
      [x - waist, y],
    ],
    [
      [x - across, y],
      [x, y - waist],
      [x + across, y],
      [x, y + waist],
    ],
  ];
}

function sparkleArm(random: () => number): number {
  // Box–Muller turns two uniform draws into one standard normal. 1 - random()
  // is in (0, 1], which keeps the log finite.
  const z = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  return Math.min(ARM.max, Math.max(ARM.min, ARM.median * Math.exp(ARM.spread * z)));
}

/** Every star the birthday sheet paints, wrapped copies included. */
export function birthdaySparkles(width: number, height: number, seed: number): Sparkle[] {
  const random = mulberry32(seed);
  const sparkles: Sparkle[] = [];
  for (let n = 0; n < BIRTHDAY_COUNT; n += 1) {
    const x = random() * width;
    const y = random() * height;
    const arm = sparkleArm(random) * height;
    const hue = birthdayHue(x / width, y / height, random() - 0.5);
    const saturation = 0.75 + 0.25 * random();
    const lightness = 0.5 + 0.12 * random();
    const reach = Math.max(arm, arm * STAR.across);
    for (const [dx, dy] of wrapOffsets(x, y, reach, width, height)) {
      sparkles.push({ x: x + dx, y: y + dy, arm, hue, saturation, lightness });
    }
  }
  return sparkles;
}

// The ball patterns: the reference's pokeball-outer / -inner and
// masterball-outer / -inner are alpha masks, opaque ball glyphs on a
// transparent ground, and the foil shows only where they are opaque. This DSL
// samples colour, not alpha, so ours carry that alpha as brightness: white
// glyphs (foil) on black (none). See the ball kinds in shader/types.ts for how
// an effect is meant to combine them.

export const BALL_TILE = 512;
/** Glyphs per side of the tile. Even, so the size checkerboard survives the wrap. */
const BALL_CELLS = 2;
/** A glyph's radius as a share of the lattice spacing: the reference's two sizes. */
const BALL_RADIUS = { large: 0.42, small: 0.26 };

export interface BallGlyph {
  x: number;
  y: number;
  r: number;
}

/**
 * The ball lattice: glyphs on a square grid with their sizes in a checkerboard.
 * Every row alternates large and small, starting with the other size from the
 * row above, so the large balls sit staggered on the diagonals with the small
 * ones between them, as in the reference. The grid's points fall on the tile's
 * edges and corners, so the glyphs there straddle the seam and ballPlacements
 * draws them wrapped.
 */
export function ballLattice(tile: number): BallGlyph[] {
  const cell = tile / BALL_CELLS;
  const glyphs: BallGlyph[] = [];
  for (let row = 0; row < BALL_CELLS; row += 1) {
    for (let col = 0; col < BALL_CELLS; col += 1) {
      const large = (row + col) % 2 === 0;
      glyphs.push({
        x: col * cell,
        y: row * cell,
        r: cell * (large ? BALL_RADIUS.large : BALL_RADIUS.small),
      });
    }
  }
  return glyphs;
}

/** Every glyph a ball pattern paints, wrapped copies included. */
export function ballPlacements(tile: number): BallGlyph[] {
  return ballLattice(tile).flatMap((glyph) =>
    wrapOffsets(glyph.x, glyph.y, glyph.r, tile, tile).map(([dx, dy]) => ({
      ...glyph,
      x: glyph.x + dx,
      y: glyph.y + dy,
    })),
  );
}

// ------------------------------------------------ canvas, browser-only below

const cache = new Map<TextureName, HTMLCanvasElement>();

function canvasOf(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for the holo texture');
  return { canvas, ctx };
}

function sparkle(): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(512, 512);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i += 1) {
    const value = Math.random();
    ctx.fillStyle = `rgba(255,255,255,${(value * value).toFixed(3)})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.4, 1.4);
  }
  return canvas;
}

function grain(): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(1024, 1024);
  const base = ctx.createLinearGradient(0, 0, 1024, 1024);
  base.addColorStop(0, '#120a2e');
  base.addColorStop(0.5, '#3b1a6b');
  base.addColorStop(1, '#0a1e4a');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i += 1) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = Math.random() * 90 + 30;
    const nebula = ctx.createRadialGradient(x, y, 0, x, y, r);
    nebula.addColorStop(0, `rgba(160,120,255,${(Math.random() * 0.14).toFixed(3)})`);
    nebula.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 2400; i += 1) {
    const alpha = Math.random() ** 2;
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.6, 1.6);
  }
  return canvas;
}

function iri(): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(IRI_SIZE, IRI_SIZE);
  const image = ctx.createImageData(IRI_SIZE, IRI_SIZE);
  image.data.set(iriPixels(IRI_SIZE, IRI_SEED));
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function birthday(): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(BIRTHDAY_WIDTH, BIRTHDAY_HEIGHT);
  ctx.fillStyle = BIRTHDAY_BACKGROUND;
  ctx.fillRect(0, 0, BIRTHDAY_WIDTH, BIRTHDAY_HEIGHT);
  for (const star of birthdaySparkles(BIRTHDAY_WIDTH, BIRTHDAY_HEIGHT, BIRTHDAY_SEED)) {
    const s = (star.saturation * 100).toFixed(1);
    const l = (star.lightness * 100).toFixed(1);
    ctx.fillStyle = `hsl(${star.hue.toFixed(1)}, ${s}%, ${l}%)`;
    for (const diamond of starDiamonds(star)) {
      ctx.beginPath();
      diamond.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.fill();
    }
  }
  return canvas;
}

/** White where the reference's mask shows foil, black where it does not. */
const FOIL = '#fff';
const BARE = '#000';

/**
 * A ball glyph at unit radius, y down; every number is a share of the glyph's
 * radius. The outline is an outer ring, a double band through the middle that
 * runs into a housing ring, and a small button ring at the centre. The cap is
 * the fill of the upper half, inside the ring, above the band and clear of the
 * housing, with a gap to each so it never touches the outline. The Master Ball
 * adds two lobes and an M to both.
 */
const GLYPH = {
  ring: { r: 0.93, width: 0.14 },
  band: { y: 0.11, width: 0.075 },
  housing: { r: 0.36, width: 0.075 },
  button: { r: 0.17, width: 0.075 },
  cap: { r: 0.84, bottom: -0.17, clear: 0.43 },
  lobes: { x: 0.52, y: -0.5, r: 0.24 },
  m: [
    [-0.14, -0.46],
    [-0.14, -0.74],
    [0, -0.6],
    [0.14, -0.74],
    [0.14, -0.46],
  ] as Point[],
  line: 0.075,
  gap: 0.04,
};

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, width: number) {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function polyline(ctx: CanvasRenderingContext2D, points: Point[], width: number) {
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
}

function drawBallOutline(ctx: CanvasRenderingContext2D) {
  ring(ctx, 0, 0, GLYPH.ring.r, GLYPH.ring.width);
  ring(ctx, 0, 0, GLYPH.housing.r, GLYPH.housing.width);
  ring(ctx, 0, 0, GLYPH.button.r, GLYPH.button.width);
  // The double band: a bar either side of the centre line, on both sides of
  // the housing, each running from under the ring's stroke to under the
  // housing's.
  const length = GLYPH.ring.r - GLYPH.housing.r;
  for (const y of [-GLYPH.band.y, GLYPH.band.y]) {
    for (const x of [-GLYPH.ring.r, GLYPH.housing.r]) {
      ctx.fillRect(x, y - GLYPH.band.width / 2, length, GLYPH.band.width);
    }
  }
}

function drawBallCap(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, GLYPH.cap.r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillRect(-1, -1, 2, 1 + GLYPH.cap.bottom);
  ctx.fillStyle = BARE;
  ctx.beginPath();
  ctx.arc(0, 0, GLYPH.cap.clear, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMasterballOutline(ctx: CanvasRenderingContext2D) {
  drawBallOutline(ctx);
  for (const side of [-1, 1]) {
    ring(ctx, side * GLYPH.lobes.x, GLYPH.lobes.y, GLYPH.lobes.r, GLYPH.line);
  }
  polyline(ctx, GLYPH.m, GLYPH.line);
}

function drawMasterballCap(ctx: CanvasRenderingContext2D) {
  drawBallCap(ctx);
  // Cut the lobes' outlines and the M out of the cap, a little wider than the
  // outline draws them, so the cap and the outline stay apart here too.
  ctx.save();
  ctx.strokeStyle = BARE;
  const cut = GLYPH.line + 2 * GLYPH.gap;
  for (const side of [-1, 1]) {
    ring(ctx, side * GLYPH.lobes.x, GLYPH.lobes.y, GLYPH.lobes.r, cut);
  }
  polyline(ctx, GLYPH.m, cut);
  ctx.restore();
}

function ballPattern(draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(BALL_TILE, BALL_TILE);
  ctx.fillStyle = BARE;
  ctx.fillRect(0, 0, BALL_TILE, BALL_TILE);
  ctx.lineJoin = 'round';
  for (const glyph of ballPlacements(BALL_TILE)) {
    ctx.save();
    ctx.translate(glyph.x, glyph.y);
    ctx.scale(glyph.r, glyph.r);
    ctx.fillStyle = FOIL;
    ctx.strokeStyle = FOIL;
    draw(ctx);
    ctx.restore();
  }
  return canvas;
}

const GENERATORS: Record<TextureName, () => HTMLCanvasElement> = {
  glitter: sparkle,
  grain,
  iri,
  birthday,
  pokeball: () => ballPattern(drawBallOutline),
  'pokeball-inner': () => ballPattern(drawBallCap),
  masterball: () => ballPattern(drawMasterballOutline),
  'masterball-inner': () => ballPattern(drawMasterballCap),
};

/** Generated once at runtime, shared by every effect that names them. */
export function makeTexture(name: TextureName): HTMLCanvasElement {
  const hit = cache.get(name);
  if (hit) return hit;
  const made = GENERATORS[name]();
  cache.set(name, made);
  return made;
}
