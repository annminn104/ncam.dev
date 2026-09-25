/**
 * The generated textures the foil layers sample; scene.ts shares each one
 * across every effect that names it. All of them are drawn here at runtime.
 * Nothing is fetched, and none is a copy of the reference's own foil images,
 * which are their author's assets.
 *
 * grain alone still draws with Math.random, and so differs a little on every
 * load. Every other texture is fixed, so a card looks the same on every visit:
 * glitter, iri and birthday draw from a seeded PRNG, geometric's maze from a
 * seeded choice per cell, and trainerbg and the ball patterns are pure
 * geometry. glitter, geometric and trainerbg stand in for the pokemon-cards-css
 * images the legacy shine ports name (glitter.png, geometric.png,
 * trainerbg.png): drawn to the motif, scale and tones measured off those
 * images headless, at their natural sizes, so a CSS background-size means the
 * same thing here (TEXTURE_SIZE).
 *
 * Tests run under node with no DOM, so the canvas painters at the bottom of
 * this file cannot run there. What they paint is decided by the pure functions
 * above them, which textures.test.ts holds to account: the PRNG, the pixels of
 * iri, glitter, geometric and trainerbg (each whole texture, byte for byte),
 * the star's shape, sizes and colours, the ball lattice, and the wrapping that
 * makes each texture tile. Left untested: the canvas calls themselves, and the
 * ball glyphs' internal drawing.
 */

export type TextureName =
  | 'glitter'
  | 'grain'
  | 'iri'
  | 'birthday'
  | 'pokeball'
  | 'pokeball-inner'
  | 'masterball'
  | 'masterball-inner'
  | 'geometric'
  | 'trainerbg'
  | 'illusion'
  | 'illusion-mask';

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
/**
 * A glyph's radius as a share of the lattice spacing: the reference's two
 * sizes, measured off pokeball-outer.webp's pixels (0.4367 and 0.2593).
 */
const BALL_RADIUS = { large: 0.437, small: 0.26 };

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

const mod = (n: number, m: number) => ((n % m) + m) % m;

// glitter: the reference's glitter.png is a 630 × 540 sheet, measured
// headless at mean grey 51, 61% of it below 32 and 9% at 160 or above: a dark
// grain lit by dense specks and a few star flares, thicker in some patches
// than others. Drawn to those tones.

export const GLITTER_WIDTH = 630;
export const GLITTER_HEIGHT = 540;
/** Any fixed value. Changing it redraws every legacy card's glitter. */
export const GLITTER_SEED = 630;

const GLITTER = {
  /** the ground: an exponential spread of dark greys, capped */
  ground: { mean: 28, max: 127 },
  specks: { count: 9000, sizes: [1, 1, 1, 2, 2, 3, 4], low: 190, high: 255 },
  stars: { count: 60, arm: [3, 9], low: 200, high: 255 },
  /** patches: a smooth density over a coarse lattice, cells across and down, and its range */
  patches: { across: 6, down: 5, low: 0.4, high: 1.6 },
};

/**
 * A smooth, tiling field over the sheet: random values on a coarse lattice,
 * blended between with smoothstep, wrapping at the edges. Where it is high the
 * glitter is thicker and its ground a little brighter.
 */
export function glitterDensity(
  width: number,
  height: number,
  random: () => number,
): (x: number, y: number) => number {
  const { across, down, low, high } = GLITTER.patches;
  const lattice = Array.from({ length: across * down }, () => low + (high - low) * random());
  const at = (i: number, j: number) => lattice[mod(j, down) * across + mod(i, across)];
  const ease = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const u = (x / width) * across;
    const v = (y / height) * down;
    const [i, j] = [Math.floor(u), Math.floor(v)];
    const [fu, fv] = [ease(u - i), ease(v - j)];
    const top = at(i, j) + (at(i + 1, j) - at(i, j)) * fu;
    const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
    return top + (bottom - top) * fv;
  };
}

/** A square speck of this grey, wrapped across the sheet's edges; the brighter value wins. */
export function plotSpeck(
  grey: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  size: number,
  value: number,
): void {
  for (let dy = 0; dy < size; dy += 1) {
    for (let dx = 0; dx < size; dx += 1) {
      const i = ((y + dy) % height) * width + ((x + dx) % width);
      grey[i] = Math.max(grey[i], value);
    }
  }
}

/**
 * A round speck `size` px across, full value at its middle and falling off
 * toward its rim, wrapped; a 1 px one is a single pixel.
 */
function plotDot(
  grey: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  size: number,
  value: number,
): void {
  const r = size / 2;
  for (let dy = 0; dy < size; dy += 1) {
    for (let dx = 0; dx < size; dx += 1) {
      const d = Math.hypot(dx + 0.5 - r, dy + 0.5 - r) / r;
      if (d > 1 && size > 1) continue;
      const v = size > 1 ? value * (1 - 0.3 * d * d) : value;
      plotSpeck(grey, width, height, (x + dx) % width, (y + dy) % height, 1, v);
    }
  }
}

/** A four-pointed flare: arms on the axes, fading out toward their tips, wrapped. */
function plotStar(
  grey: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  arm: number,
  value: number,
): void {
  plotSpeck(grey, width, height, x, y, 1, value);
  for (let k = 1; k <= arm; k += 1) {
    const v = value * (1 - k / (arm + 1));
    for (const [dx, dy] of [
      [k, 0],
      [-k, 0],
      [0, k],
      [0, -k],
    ]) {
      plotSpeck(grey, width, height, (x + dx + width) % width, (y + dy + height) % height, 1, v);
    }
  }
}

/** The whole glitter sheet as opaque RGBA bytes, ready for putImageData. */
export function glitterPixels(width: number, height: number, seed: number): Uint8ClampedArray {
  const random = mulberry32(seed);
  const density = glitterDensity(width, height, random);
  const { ground, specks, stars, patches } = GLITTER;
  const grey = new Float32Array(width * height);
  for (let i = 0; i < grey.length; i += 1) {
    const d = density(i % width, Math.floor(i / width));
    grey[i] = Math.min(ground.max, -ground.mean * (0.7 + 0.3 * d) * Math.log(1 - random()));
  }
  for (let n = 0; n < specks.count;) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height);
    // kept in proportion to the density there, so the patches show
    if (random() * patches.high > density(x, y)) continue;
    const size = specks.sizes[Math.floor(random() * specks.sizes.length)];
    plotDot(grey, width, height, x, y, size, specks.low + random() * (specks.high - specks.low));
    n += 1;
  }
  for (let n = 0; n < stars.count; n += 1) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height);
    const arm = stars.arm[0] + Math.floor(random() * (stars.arm[1] - stars.arm[0] + 1));
    plotStar(grey, width, height, x, y, arm, stars.low + random() * (stars.high - stars.low));
  }
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < grey.length; i += 1) pixels.set([grey[i], grey[i], grey[i], 255], i * 4);
  return pixels;
}

// geometric: the reference's geometric.png, measured headless, is white
// stripes on black at 45°, about 11.8 px apart and 3.3 px wide, turning in
// nested Ls. Ours: 18 stripes a tile along each diagonal, 28% of each period
// white, in maze cells six stripes across.

export const GEOMETRIC_SIZE = 300;
/** Any fixed value. Changing it redraws the maze. */
export const GEOMETRIC_SEED = 300;

const GEOMETRIC = { stripes: 18, white: 0.28, cellStripes: 6, samples: 4 };

/**
 * Which figure fills maze cell (i, j): stripes straight along either diagonal
 * (0, 1), or nested Ls about one of the cell's four corners (2 to 5). Cells
 * sit on the diagonals p = x + y and q = x - y, and the tile repeats every
 * `cells` cells along both, as (i + cells, j ± cells), so a cell and its
 * copies across the tile's edges draw the same figure.
 */
export function geometricFigure(i: number, j: number, cells: number, seed: number): number {
  const u = mod(i + j, 2 * cells);
  const v = mod(i - j, 2 * cells);
  return Math.floor(mulberry32(seed * 7919 + u * 104729 + v * 1299709)() * 6);
}

/** The whole maze as opaque RGBA bytes, supersampled. */
export function geometricPixels(size: number, seed: number): Uint8ClampedArray {
  const period = size / GEOMETRIC.stripes;
  const cell = period * GEOMETRIC.cellStripes;
  const cells = size / cell;
  const figures = new Map<string, number>();
  const figure = (i: number, j: number) => {
    const key = `${mod(i + j, 2 * cells)},${mod(i - j, 2 * cells)}`;
    let found = figures.get(key);
    if (found === undefined) {
      found = geometricFigure(i, j, cells, seed);
      figures.set(key, found);
    }
    return found;
  };
  const n = GEOMETRIC.samples;
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let white = 0;
      for (let sy = 0; sy < n; sy += 1) {
        for (let sx = 0; sx < n; sx += 1) {
          const px = x + (sx + 0.5) / n;
          const py = y + (sy + 0.5) / n;
          const p = px + py;
          const q = px - py;
          const i = Math.floor(p / cell);
          const j = Math.floor(q / cell);
          const s = p - i * cell;
          const t = q - j * cell;
          const fig = figure(i, j);
          const corner = fig - 2;
          const d =
            fig === 0
              ? s
              : fig === 1
                ? t
                : Math.max(corner & 1 ? cell - s : s, corner & 2 ? cell - t : t);
          if (Math.abs(mod(d / period, 1) - 0.5) < GEOMETRIC.white / 2) white += 1;
        }
      }
      const v = Math.round((white / (n * n)) * 255);
      pixels.set([v, v, v, 255], (y * size + x) * 4);
    }
  }
  return pixels;
}

// trainerbg: the reference's trainerbg.png, measured headless, is 16 blue
// lines a 208 px tile, rising left to right, each waving twice across it about
// 4.8 px either way and about 2.2 px thick, ink rgb(42, 176, 210) on white.

export const TRAINERBG_SIZE = 208;

const TRAINERBG = {
  lines: 16,
  waves: 2,
  amplitude: 4.8,
  width: 2.2,
  ink: [42, 176, 210] as const,
  samples: 4,
};

/** The whole wave pattern as opaque RGBA bytes, supersampled. */
export function trainerbgPixels(size: number): Uint8ClampedArray {
  const period = size / TRAINERBG.lines;
  const k = (2 * Math.PI * TRAINERBG.waves) / size;
  const n = TRAINERBG.samples;
  const [r, g, b] = TRAINERBG.ink;
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let ink = 0;
      for (let sy = 0; sy < n; sy += 1) {
        for (let sx = 0; sx < n; sx += 1) {
          const px = x + (sx + 0.5) / n;
          const py = y + (sy + 0.5) / n;
          // lines of constant phi rise left to right; the wave runs along them
          const slope = TRAINERBG.amplitude * k * Math.cos(k * (px - py));
          const phi = px + py + TRAINERBG.amplitude * Math.sin(k * (px - py));
          const m = mod(phi, period);
          const distance = Math.min(m, period - m) / Math.hypot(1 + slope, 1 - slope);
          if (distance < TRAINERBG.width / 2) ink += 1;
        }
      }
      const f = ink / (n * n);
      pixels.set(
        [255 + (r - 255) * f, 255 + (g - 255) * f, 255 + (b - 255) * f, 255],
        (y * size + x) * 4,
      );
    }
  }
  return pixels;
}

// illusion: the reference's illusion.png, measured headless, is black and
// white bands, a little more white than black, about 14 px a pair and fairly
// even, running round a lens that rises along the diagonal and round the
// tile's corners, the two sets of rings meeting in S-curves; illusion-mask.png
// is the same grey with alpha min(1, 1.4 · (1 - grey)): opaque where black,
// all but clear where white. Ours: even bands of the distance to the nearer of
// the tile's two centres, its middle and its corner, in a metric stretched
// along the rising diagonal, the distance rippled by a gentle wave.

export const ILLUSION_SIZE = 600;

const ILLUSION = { period: 11, black: 0.42, stretch: 1.9, ripple: 9, samples: 3 };

/**
 * The field the bands are cut from, in px: the distance to the nearer of the
 * tile's two centres, (0, 0) and (size / 2, size / 2), or a copy of one across
 * its edges, measured with lengths along the rising diagonal shrunk by
 * `stretch`, plus a ripple that repeats with the tile. Every term repeats
 * every `size` px each way, so the bands tile.
 */
export function illusionField(x: number, y: number, size: number): number {
  // in the tile first, so the copies one tile over are every copy near enough
  const [tx, ty] = [mod(x, size), mod(y, size)];
  let nearest = Infinity;
  for (const [cx, cy] of [
    [0, 0],
    [size / 2, size / 2],
  ]) {
    for (let i = -1; i <= 1; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        const dx = tx - (cx + i * size);
        const dy = ty - (cy + j * size);
        const along = (dx - dy) / Math.SQRT2;
        const across = (dx + dy) / Math.SQRT2;
        nearest = Math.min(nearest, Math.hypot(along / ILLUSION.stretch, across));
      }
    }
  }
  const k = (2 * Math.PI) / size;
  return nearest + ILLUSION.ripple * Math.sin(2 * k * x + 0.7) * Math.sin(2 * k * y + 1.9);
}

/** The bands as one grey per pixel, supersampled: 0 black, 1 white. */
function illusionGreys(size: number): Float32Array {
  const n = ILLUSION.samples;
  const greys = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let white = 0;
      for (let sy = 0; sy < n; sy += 1) {
        for (let sx = 0; sx < n; sx += 1) {
          const band =
            illusionField(x + (sx + 0.5) / n, y + (sy + 0.5) / n, size) / ILLUSION.period;
          if (mod(band, 1) >= ILLUSION.black) white += 1;
        }
      }
      greys[y * size + x] = white / (n * n);
    }
  }
  return greys;
}

/** The illusion bands as opaque RGBA bytes. */
export function illusionPixels(size: number): Uint8ClampedArray {
  const greys = illusionGreys(size);
  const pixels = new Uint8ClampedArray(size * size * 4);
  greys.forEach((g, i) => pixels.set([g * 255, g * 255, g * 255, 255], i * 4));
  return pixels;
}

/** The same bands with illusion-mask.png's alpha: min(1, 1.4 · (1 - grey)). */
export function illusionMaskPixels(size: number): Uint8ClampedArray {
  const greys = illusionGreys(size);
  const pixels = new Uint8ClampedArray(size * size * 4);
  greys.forEach((g, i) =>
    pixels.set([g * 255, g * 255, g * 255, Math.min(1, 1.4 * (1 - g)) * 255], i * 4),
  );
  return pixels;
}

/**
 * Each texture's natural size in px, as its painter draws it: what a CSS
 * `background-size` with an `auto` side measures against (css.ts#autoHeight).
 */
export const TEXTURE_SIZE: Record<TextureName, readonly [number, number]> = {
  glitter: [GLITTER_WIDTH, GLITTER_HEIGHT],
  grain: [1024, 1024],
  iri: [IRI_SIZE, IRI_SIZE],
  birthday: [BIRTHDAY_WIDTH, BIRTHDAY_HEIGHT],
  pokeball: [BALL_TILE, BALL_TILE],
  'pokeball-inner': [BALL_TILE, BALL_TILE],
  masterball: [BALL_TILE, BALL_TILE],
  'masterball-inner': [BALL_TILE, BALL_TILE],
  geometric: [GEOMETRIC_SIZE, GEOMETRIC_SIZE],
  trainerbg: [TRAINERBG_SIZE, TRAINERBG_SIZE],
  illusion: [ILLUSION_SIZE, ILLUSION_SIZE],
  'illusion-mask': [ILLUSION_SIZE, ILLUSION_SIZE],
};

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

/** A canvas painted with these RGBA bytes. */
function fromPixels(width: number, height: number, pixels: Uint8ClampedArray): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(width, height);
  const image = ctx.createImageData(width, height);
  image.data.set(pixels);
  ctx.putImageData(image, 0, 0);
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
  return fromPixels(IRI_SIZE, IRI_SIZE, iriPixels(IRI_SIZE, IRI_SEED));
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
 * radius, measured off the reference's pokeball-outer.webp and
 * pokeball-inner.webp by scanning across and down through a glyph's centre
 * (2026-09-24). The outline is an outer ring, a housing ring and a button
 * ring, joined by a band of three bars: one along the centre line, from the
 * button out through the housing to the ring, and one above and below it,
 * from the housing out to the ring only. The cap is the rest of the upper
 * half: inside the ring, outside the housing, above the upper bar, touching
 * each as the reference's does. The Master Ball's outline is the Poké Ball's
 * stroke for stroke, and adds two lobes and an M to both.
 */
const GLYPH = {
  ring: { r: 0.93, width: 0.139 },
  bars: { centre: 0.137, side: { y: 0.217, width: 0.122 } },
  housing: { r: 0.476, width: 0.122 },
  button: { r: 0.25, width: 0.135 },
  cap: { r: 0.861, bottom: -0.278, clear: 0.537 },
  // The Master Ball's two lobes: discs up and out on either side, reaching
  // past the ball's edge, fitted to masterball-outer.webp's lobe stroke — a
  // circle through each of its edges where it crosses rays at -150, -135 and
  // -120 degrees, both about the same centre. Inside a lobe the outer ring
  // thins to a rim and the rest is cap.
  lobes: { x: 0.753, y: -0.8, r: 0.415, stroke: 0.091, rim: 0.965 },
  // the M, its legs leaning in toward the top
  m: [
    [-0.126, -0.57],
    [-0.095, -0.8],
    [0, -0.625],
    [0.095, -0.8],
    [0.126, -0.57],
  ] as Point[],
  line: 0.075,
  // the sliver the Master Ball's cap keeps from its lobe strokes and M
  gap: 0.01,
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
  // The centre bar, on both sides, from under the button's stroke out to under
  // the ring's, across the housing.
  const { centre, side } = GLYPH.bars;
  const long = GLYPH.ring.r - GLYPH.button.r;
  for (const x of [-GLYPH.ring.r, GLYPH.button.r]) {
    ctx.fillRect(x, -centre / 2, long, centre);
  }
  // A bar above and below it, from under the housing's stroke out to under the
  // ring's, on both sides.
  const short = GLYPH.ring.r - GLYPH.housing.r;
  for (const y of [-side.y, side.y]) {
    for (const x of [-GLYPH.ring.r, GLYPH.housing.r]) {
      ctx.fillRect(x, y - side.width / 2, short, side.width);
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

/** Clip to one lobe's disc inside a circle of radius `within` about the ball's centre. */
function clipToLobe(ctx: CanvasRenderingContext2D, side: number, within: number) {
  const { x, y, r } = GLYPH.lobes;
  ctx.beginPath();
  ctx.arc(0, 0, within, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(side * x, y, r, 0, Math.PI * 2);
  ctx.clip();
}

function drawMasterballOutline(ctx: CanvasRenderingContext2D) {
  drawBallOutline(ctx);
  const { x, y, r, stroke, rim } = GLYPH.lobes;
  for (const side of [-1, 1]) {
    // Inside the lobe the ring thins to a rim at the ball's edge.
    ctx.save();
    clipToLobe(ctx, side, 1.02);
    ctx.fillStyle = BARE;
    ctx.fillRect(-1.1, -1.1, 2.2, 2.2);
    ctx.fillStyle = FOIL;
    ring(ctx, 0, 0, (rim + 1) / 2, 1 - rim);
    ctx.restore();
    // The lobe's stroke, where its disc lies inside the rim.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, rim, 0, Math.PI * 2);
    ctx.clip();
    ring(ctx, side * x, y, r, stroke);
    ctx.restore();
  }
  polyline(ctx, GLYPH.m, GLYPH.line);
}

function drawMasterballCap(ctx: CanvasRenderingContext2D) {
  drawBallCap(ctx);
  const { x, y, r, stroke, rim } = GLYPH.lobes;
  // The lobes are cap as well, out to the rim.
  for (const side of [-1, 1]) {
    ctx.save();
    clipToLobe(ctx, side, rim);
    ctx.fillRect(-1.1, -1.1, 2.2, 2.2);
    ctx.restore();
  }
  // Cut the lobes' strokes and the M out of the cap, a sliver wider than the
  // outline draws them, so the two masks meet without overlapping.
  ctx.save();
  ctx.strokeStyle = BARE;
  for (const side of [-1, 1]) ring(ctx, side * x, y, r, stroke + 2 * GLYPH.gap);
  polyline(ctx, GLYPH.m, GLYPH.line + 2 * GLYPH.gap);
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
  glitter: () =>
    fromPixels(
      GLITTER_WIDTH,
      GLITTER_HEIGHT,
      glitterPixels(GLITTER_WIDTH, GLITTER_HEIGHT, GLITTER_SEED),
    ),
  grain,
  iri,
  birthday,
  pokeball: () => ballPattern(drawBallOutline),
  'pokeball-inner': () => ballPattern(drawBallCap),
  masterball: () => ballPattern(drawMasterballOutline),
  'masterball-inner': () => ballPattern(drawMasterballCap),
  geometric: () =>
    fromPixels(GEOMETRIC_SIZE, GEOMETRIC_SIZE, geometricPixels(GEOMETRIC_SIZE, GEOMETRIC_SEED)),
  trainerbg: () => fromPixels(TRAINERBG_SIZE, TRAINERBG_SIZE, trainerbgPixels(TRAINERBG_SIZE)),
  illusion: () => fromPixels(ILLUSION_SIZE, ILLUSION_SIZE, illusionPixels(ILLUSION_SIZE)),
  'illusion-mask': () =>
    fromPixels(ILLUSION_SIZE, ILLUSION_SIZE, illusionMaskPixels(ILLUSION_SIZE)),
};

/** Generated once at runtime, shared by every effect that names them. */
export function makeTexture(name: TextureName): HTMLCanvasElement {
  const hit = cache.get(name);
  if (hit) return hit;
  const made = GENERATORS[name]();
  cache.set(name, made);
  return made;
}
