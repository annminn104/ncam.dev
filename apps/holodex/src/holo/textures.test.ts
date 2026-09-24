import { describe, expect, it } from 'vitest';
import {
  BALL_TILE,
  BIRTHDAY_HEIGHT,
  BIRTHDAY_SEED,
  BIRTHDAY_WIDTH,
  IRI_BACKGROUND,
  IRI_SEED,
  IRI_SIZE,
  ballLattice,
  ballPlacements,
  birthdayHue,
  birthdaySparkles,
  iriPixels,
  mulberry32,
  starDiamonds,
} from './textures';

// textures.ts's canvas painters need a DOM this suite does not have. What they
// paint is decided by the pure functions tested here.

interface Shape {
  x: number;
  y: number;
  reach: number;
}

/**
 * Holds a texture's layout to tiling seamlessly. `drawn` is every shape the
 * painter puts down, wrapped copies included. The texture repeats every
 * width × height, so each shape it draws reappears one tile over in every
 * direction; wherever such a repeat reaches into the tile, the painter must
 * have drawn it there too, or the repeat shows that shape cut off at the seam.
 */
function expectSeamless(drawn: Shape[], width: number, height: number) {
  const reachesIn = (s: Shape) =>
    s.x + s.reach > 0 && s.x - s.reach < width && s.y + s.reach > 0 && s.y - s.reach < height;
  const drawnAt = (s: Shape) =>
    drawn.some(
      (d) =>
        Math.abs(d.x - s.x) < 1e-6 &&
        Math.abs(d.y - s.y) < 1e-6 &&
        Math.abs(d.reach - s.reach) < 1e-9,
    );
  const missing: string[] = [];
  let repeatsReachingIn = 0;
  for (const shape of drawn) {
    for (const dx of [-width, 0, width]) {
      for (const dy of [-height, 0, height]) {
        if (dx === 0 && dy === 0) continue;
        const repeat = { x: shape.x + dx, y: shape.y + dy, reach: shape.reach };
        if (!reachesIn(repeat)) continue;
        repeatsReachingIn += 1;
        if (!drawnAt(repeat)) missing.push(`(${repeat.x.toFixed(1)}, ${repeat.y.toFixed(1)})`);
      }
    }
  }
  // With nothing crossing an edge there is nothing to wrap, and the check
  // below would pass without proving anything.
  expect(repeatsReachingIn).toBeGreaterThan(0);
  expect(missing).toEqual([]);
}

/** Ray casting: whether (x, y) lies inside the polygon. */
function inPolygon(polygon: Array<[number, number]>, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The HSL hue of a byte colour, in degrees. */
function hueOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  const h =
    max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
  return (h * 60 + 360) % 360;
}

const circularDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

/**
 * Where two long number sequences first differ, or -1. A plain toEqual on
 * 360,000 bytes spends a minute building a diff whenever it fails.
 */
function firstDifference(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) if (a[i] !== b[i]) return i;
  return -1;
}

const sparkleNumbers = (sparkles: ReturnType<typeof birthdaySparkles>) =>
  sparkles.flatMap((s) => [s.x, s.y, s.arm, s.hue, s.saturation, s.lightness]);

describe('mulberry32', () => {
  it('replays the same sequence for the same seed, and another for another seed', () => {
    const draws = (seed: number) => Array.from({ length: 64 }, mulberry32(seed));
    expect(draws(7)).toEqual(draws(7));
    expect(draws(8)).not.toEqual(draws(7));
  });

  it('spreads its draws evenly across [0, 1)', () => {
    const random = mulberry32(12345);
    const deciles = new Array<number>(10).fill(0);
    let outside = 0;
    for (let i = 0; i < 20000; i += 1) {
      const v = random();
      if (v >= 0 && v < 1) deciles[Math.floor(v * 10)] += 1;
      else outside += 1;
    }
    expect(outside).toBe(0);
    // Each decile's count has a standard deviation of about 42; 200 is ~5.
    for (const count of deciles) expect(Math.abs(count - 2000)).toBeLessThan(200);
  });
});

describe('iriPixels', () => {
  const pixels = iriPixels(IRI_SIZE, IRI_SEED);
  const area = IRI_SIZE * IRI_SIZE;
  /** Every pixel that is not the ground. */
  const dots: Array<[number, number, number]> = [];
  for (let p = 0; p < area; p += 1) {
    const rgb: [number, number, number] = [pixels[p * 4], pixels[p * 4 + 1], pixels[p * 4 + 2]];
    if (rgb.some((v, i) => v !== IRI_BACKGROUND[i])) dots.push(rgb);
  }

  it('draws the same speckle on every load', () => {
    expect(firstDifference(iriPixels(IRI_SIZE, IRI_SEED), pixels)).toBe(-1);
    expect(firstDifference(iriPixels(IRI_SIZE, IRI_SEED + 1), pixels)).not.toBe(-1);
  });

  it('scatters dots over about a seventh of an opaque ground', () => {
    expect(pixels).toHaveLength(area * 4);
    let translucent = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) translucent += 1;
    // The canvas keeps colour premultiplied by alpha and the shader reads
    // colour alone, so a translucent texel would not come back as drawn.
    expect(translucent).toBe(0);
    // The reference's iri-8 lights 14.8% of its pixels.
    expect(dots.length / area).toBeGreaterThan(0.11);
    expect(dots.length / area).toBeLessThan(0.17);
  });

  it('keeps to pale violet, blue and near-white, bright against the ground', () => {
    const groundLight = (Math.max(...IRI_BACKGROUND) + Math.min(...IRI_BACKGROUND)) / 2;
    const off: string[] = [];
    let white = 0;
    let violet = 0;
    let blue = 0;
    for (const [r, g, b] of dots) {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      // No dot is dim, and none is vivid: nine in ten of the reference's sit
      // within 32 of grey, and none reaches 64.
      if ((max + min) / 2 < 2 * groundLight || chroma >= 64) off.push(`${r},${g},${b}`);
      else if (chroma < 16) white += 1;
      else {
        const hue = hueOf(r, g, b);
        // nothing warm and nothing green
        if (hue < 195 || hue > 290) off.push(`${r},${g},${b}`);
        else if (hue >= 250) violet += 1;
        else blue += 1;
      }
    }
    expect(off.length, off.slice(0, 5).join(' ')).toBe(0);
    expect(white / dots.length).toBeGreaterThan(0.4);
    expect(violet / dots.length).toBeGreaterThan(0.2);
    expect(blue / dots.length).toBeGreaterThan(0.08);
  });
});

describe('the birthday sparkles', () => {
  const sparkles = birthdaySparkles(BIRTHDAY_WIDTH, BIRTHDAY_HEIGHT, BIRTHDAY_SEED);
  // Wrapped copies sit a whole tile away, outside it, so the stars inside the
  // tile are the sheet itself.
  const sheet = sparkles.filter(
    (s) => s.x >= 0 && s.x < BIRTHDAY_WIDTH && s.y >= 0 && s.y < BIRTHDAY_HEIGHT,
  );

  it('draws the same sheet on every load', () => {
    const again = birthdaySparkles(BIRTHDAY_WIDTH, BIRTHDAY_HEIGHT, BIRTHDAY_SEED);
    expect(firstDifference(sparkleNumbers(again), sparkleNumbers(sparkles))).toBe(-1);
  });

  it('tiles without a seam', () => {
    expectSeamless(
      sparkles.map((s) => ({ x: s.x, y: s.y, reach: s.arm })),
      BIRTHDAY_WIDTH,
      BIRTHDAY_HEIGHT,
    );
  });

  it('draws each as a four-pointed star: long thin rays on the axes, nothing on the diagonals', () => {
    const star = starDiamonds({ x: 0, y: 0, arm: 10 });
    const inStar = (x: number, y: number) => star.some((diamond) => inPolygon(diamond, x, y));
    // the centre, and all four rays out to near their tips
    expect([inStar(0, 0), inStar(0, -9), inStar(0, 9), inStar(-7, 0), inStar(7, 0)]).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    // the vertical rays are the longer pair, and nothing reaches past them
    expect([inStar(9, 0), inStar(0, -10.5)]).toEqual([false, false]);
    // the diagonals are empty: a star, not a diamond or a square
    expect([inStar(3, -3), inStar(-3, 3)]).toEqual([false, false]);
  });

  it('varies the sizes as the reference does: mostly specks, a few large', () => {
    const arms = sheet.map((s) => s.arm).sort((a, b) => a - b);
    const smallest = arms[0];
    const median = arms[Math.floor(arms.length / 2)];
    const largest = arms[arms.length - 1];
    expect(largest / smallest).toBeGreaterThan(10);
    expect(median / largest).toBeLessThan(0.25);
  });

  it('colours them red through violet, all of it in play, and never magenta', () => {
    const between = (from: number, to: number) =>
      sheet.filter((s) => s.hue >= from && s.hue < to).length;
    expect(between(270, 330)).toBe(0);
    const bands = {
      red: between(330, 360) + between(0, 30),
      yellow: between(30, 90),
      green: between(90, 170),
      blue: between(170, 240),
      violet: between(240, 270),
    };
    for (const [band, count] of Object.entries(bands)) {
      expect(count / sheet.length, band).toBeGreaterThan(0.05);
    }
  });

  it('colours neighbours alike, as patches of a holographic sheet are', () => {
    // In the reference, a star's nearest neighbour differs from it in hue by
    // 61° on average, where any two stars differ by 89°.
    let neighbours = 0;
    let strangers = 0;
    sheet.forEach((star, i) => {
      let nearest = sheet[i === 0 ? 1 : 0];
      for (const other of sheet) {
        if (other === star) continue;
        if (
          Math.hypot(other.x - star.x, other.y - star.y) <
          Math.hypot(nearest.x - star.x, nearest.y - star.y)
        ) {
          nearest = other;
        }
      }
      neighbours += circularDistance(star.hue, nearest.hue);
      strangers += circularDistance(star.hue, sheet[(i * 7919 + 13) % sheet.length].hue);
    });
    expect(neighbours / strangers).toBeLessThan(0.8);
  });

  it('lines the colours up across the tile’s edges', () => {
    const random = mulberry32(99);
    const off: string[] = [];
    for (let i = 0; i < 200; i += 1) {
      const [u, v, jitter] = [random(), random(), random() - 0.5];
      const here = birthdayHue(u, v, jitter);
      const across = circularDistance(birthdayHue(u + 1, v, jitter), here);
      const down = circularDistance(birthdayHue(u, v + 1, jitter), here);
      if (across > 1e-6 || down > 1e-6) off.push(`(${u.toFixed(3)}, ${v.toFixed(3)})`);
    }
    expect(off).toEqual([]);
  });
});

describe('the ball lattice', () => {
  const lattice = ballLattice(BALL_TILE);
  const radii = [...new Set(lattice.map((g) => g.r))].sort((a, b) => a - b);
  /** The shortest way from one lattice point to another, across the seam if that is shorter. */
  const wrapped = (d: number) => d - BALL_TILE * Math.round(d / BALL_TILE);
  const distance = (a: Shape | { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(wrapped(a.x - b.x), wrapped(a.y - b.y));

  it('comes in two sizes, as many of each', () => {
    expect(radii).toHaveLength(2);
    const [small, large] = radii;
    expect(lattice.filter((g) => g.r === small)).toHaveLength(lattice.length / 2);
    expect(large / small).toBeGreaterThan(1.3);
  });

  it('staggers them: every ball’s nearest neighbours, across the seam too, are the other size', () => {
    for (const glyph of lattice) {
      const others = lattice.filter((o) => o !== glyph);
      const nearest = Math.min(...others.map((o) => distance(o, glyph)));
      const closest = others.filter((o) => Math.abs(distance(o, glyph) - nearest) < 1e-9);
      expect(
        closest.map((o) => o.r),
        `${glyph.x}, ${glyph.y}`,
      ).not.toContain(glyph.r);
    }
  });

  it('keeps every ball clear of every other, across the seam too', () => {
    for (const [i, a] of lattice.entries()) {
      for (const b of lattice.slice(i + 1)) {
        expect(distance(a, b), `${a.x}, ${a.y} to ${b.x}, ${b.y}`).toBeGreaterThan(a.r + b.r);
      }
    }
  });

  it('paints the lattice itself and nothing else inside the tile', () => {
    const inside = ballPlacements(BALL_TILE).filter(
      (g) => g.x >= 0 && g.x < BALL_TILE && g.y >= 0 && g.y < BALL_TILE,
    );
    expect(inside).toEqual(lattice);
  });

  it('tiles without a seam', () => {
    expectSeamless(
      ballPlacements(BALL_TILE).map((g) => ({ x: g.x, y: g.y, reach: g.r })),
      BALL_TILE,
      BALL_TILE,
    );
  });
});
