import { describe, expect, it } from 'vitest';
import { blendRGB } from '../shader/blend';
import type { PointerDriven } from '../shader/types';
import {
  BACKGROUND_X,
  BACKGROUND_Y,
  BLACK,
  CENTER,
  DARK_RADIAL,
  POINTER_X,
  POINTER_Y,
  SUNPILLAR,
  WHITE,
  affineLayers,
  colorAt,
  composeFilters,
  filterRGB,
  fixed,
  gradientT,
  grey,
  hex,
  hsl,
  linear,
  neutralBefore,
  pxWide,
  radial,
  radialMask,
  radialT,
  repeatingLinear,
  stop,
  sunpillarClr,
  sunpillarStops,
  texture,
  times,
  valueAt,
  type CssStop,
  type PointerAt,
  type RGB,
} from './css';

/** A plain CSS box, positions already evaluated at some pointer. */
interface PlainBox {
  size: [number, number];
  position: [number, number];
  tile?: [number, number];
}

/**
 * A CSS linear gradient's line position at a point of the card, worked from
 * the spec directly rather than from css.ts's algebra: the image placed by
 * background-size and -position (in px of a 63 x 88 card), the gradient line
 * through its centre, the line's start where the perpendicular through the
 * corner behind it crosses.
 */
function cssLine(angleDeg: number, box: PlainBox, uv: [number, number]): number {
  const [W, H] = [63, 88];
  const [iw, ih] = [box.size[0] * W, box.size[1] * H];
  const [tx, ty] = box.tile ?? [0, 0];
  const left = (W - iw) * box.position[0] + tx * iw;
  const top = (H - ih) * box.position[1] + ty * ih;
  const [x, y] = [uv[0] * W - left, uv[1] * H - top];
  const rad = (angleDeg * Math.PI) / 180;
  const dir = [Math.sin(rad), -Math.cos(rad)];
  const length = Math.abs(iw * Math.sin(rad)) + Math.abs(ih * Math.cos(rad));
  const start = [iw / 2 - (dir[0] * length) / 2, ih / 2 - (dir[1] * length) / 2];
  return ((x - start[0]) * dir[0] + (y - start[1]) * dir[1]) / length;
}

/**
 * A CSS `radial-gradient(farthest-corner circle at <pointer>)`'s position at a
 * point of the card, worked from the spec directly: the image placed by
 * background-size and -position (in px of a 63 x 88 card), the circle at the
 * pointer's fraction of the image, its radius the distance to whichever of the
 * image's four corners lies farthest from it.
 */
function cssRadial(box: PlainBox, pointer: [number, number], uv: [number, number]): number {
  const [W, H] = [63, 88];
  const [iw, ih] = [box.size[0] * W, box.size[1] * H];
  const [left, top] = [(W - iw) * box.position[0], (H - ih) * box.position[1]];
  const [cx, cy] = [left + iw * pointer[0], top + ih * pointer[1]];
  const corners = [
    [left, top],
    [left + iw, top],
    [left, top + ih],
    [left + iw, top + ih],
  ];
  const radius = Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  return Math.min(1, Math.hypot(uv[0] * W - cx, uv[1] * H - cy) / radius);
}

/** How far a is from b, modulo whole periods. */
const offPeriod = (a: number, b: number) => Math.abs(a - b - Math.round(a - b));

const POINTERS: PointerAt[] = [
  { fromLeft: 0, fromTop: 0 },
  { fromLeft: 0.5, fromTop: 0.5 },
  { fromLeft: 1, fromTop: 0.25 },
  { fromLeft: 0.2, fromTop: 0.9 },
];
const POINTS: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [0.3, 0.7],
  [0.5, 0.5],
  [1, 1],
  [0.85, 0.15],
];

/** Every box the ports use, with their pointer-driven positions. */
const BOXES: Array<{ size: [number, number]; position: [PointerDriven, PointerDriven] }> = [
  { size: [2, 7], position: [fixed(0), BACKGROUND_Y] },
  { size: [3, 1], position: [BACKGROUND_X, BACKGROUND_Y] },
  { size: [1.95, 1], position: [times(BACKGROUND_X, -1), times(BACKGROUND_Y, -1)] },
  { size: [2.4, 2.4], position: [CENTER, CENTER] },
  { size: [1.7, 1.7], position: [POINTER_Y, POINTER_X] },
  { size: [2, 2], position: [POINTER_X, POINTER_Y] },
];

const evaluate = (box: (typeof BOXES)[number], at: PointerAt): PlainBox => ({
  size: box.size,
  position: [valueAt(box.position[0], at, 0), valueAt(box.position[1], at, 0)],
});

describe('hsl and hex', () => {
  it('convert as CSS Color 4 does', () => {
    const cases: Array<[RGB, RGB]> = [
      [hsl(0, 100, 50), [1, 0, 0]],
      [hsl(120, 100, 25), [0, 0.5, 0]],
      [hsl(180, 10, 60), [0.56, 0.64, 0.64]],
      // hsl(295, 100%, 10%): chroma 0.2, the hue 5/6 of the way from blue to magenta
      [hsl(295, 100, 10), [0.2 * (1 - 1 / 12), 0, 0.2]],
      [hex('#0e152e'), [14 / 255, 21 / 255, 46 / 255]],
      [hex('#797979'), grey(121 / 255)],
    ];
    for (const [got, want] of cases) {
      got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 9));
    }
  });

  it('rejects a colour it cannot read rather than guessing', () => {
    expect(() => hex('#abc')).toThrow();
  });
});

describe('sunpillarClr', () => {
  it('starts each element on the colour base.css gives its --sunpillar-clr-1', () => {
    // .card__shine:before sets --sunpillar-clr-1..6 to --sunpillar-5, 6, 1, 2, 3, 4;
    // :after to 6, 1, 2, 3, 4, 5; the element itself keeps :root's 1..6.
    expect(sunpillarClr(1)).toEqual(SUNPILLAR);
    expect(sunpillarClr(5)).toEqual([4, 5, 0, 1, 2, 3].map((i) => SUNPILLAR[i]));
    expect(sunpillarClr(6)).toEqual([5, 0, 1, 2, 3, 4].map((i) => SUNPILLAR[i]));
  });
});

describe('repeatingLinear', () => {
  const stops = sunpillarStops(sunpillarClr(1));
  // one period: --sunpillar-clr-1 at 5% back to it at 35%
  const [from, span] = [0.05, 0.3];

  it('samples each point of the card where the CSS gradient does, in every box the ports use', () => {
    for (const angle of [0, 15, 45, 128.5, 133, 225]) {
      for (const box of BOXES) {
        const layer = repeatingLinear(angle, stops, box);
        for (const at of POINTERS) {
          for (const uv of POINTS) {
            const want = (cssLine(angle, evaluate(box, at), uv) - from) / span;
            expect(offPeriod(gradientT(layer, uv, at), want), `${angle}deg`).toBeLessThan(1e-9);
          }
        }
      }
    }
  });

  it('matches a value worked by hand from illustration-rare.css', () => {
    // 0deg in a 200% x 700% image at `0% var(--background-y)`, pointer halfway down, so
    // --background-y is 50%: the image's top sits 3 card heights above the card, and the
    // card's top edge is 3/7 of the way down it, s = 4/7. (4/7 - 5%) / 30% = 1.738.
    const layer = repeatingLinear(0, stops, { size: [2, 7], position: [fixed(0), BACKGROUND_Y] });
    const t = gradientT(layer, [0.3, 0], { fromTop: (0.5 - 0.33) / 0.34 });
    expect(offPeriod(t, (4 / 7 - 0.05) / 0.3)).toBeLessThan(1e-9);
  });

  it('uses an even period that ends on its first colour as it stands', () => {
    const layer = repeatingLinear(0, stops, { size: [1, 1], position: [CENTER, CENTER] });
    expect(layer.source.kind === 'repeating-linear' && layer.source.stops).toEqual(sunpillarClr(1));
  });

  it('resamples an uneven period to 8 stops, one of them on its brightest', () => {
    const peak = hsl(180, 29, 66);
    const bands: CssStop[] = [
      stop(hex('#0e1221'), 0),
      stop(hsl(180, 10, 60), 2.8),
      stop(peak, 3.5),
      stop(hsl(180, 10, 60), 4.2),
      stop(hex('#0e1221'), 7),
      stop(hex('#0e1221'), 12),
    ];
    const box = {
      size: [3, 1] as [number, number],
      position: [CENTER, CENTER] as [PointerDriven, PointerDriven],
    };
    const layer = repeatingLinear(133, bands, box);
    if (layer.source.kind !== 'repeating-linear') throw new Error('not repeating-linear');
    expect(layer.source.stops).toHaveLength(8);
    expect(layer.source.stops).toContainEqual(peak);
    // Stop k is where t reaches k / 8. Walk the CSS line from any point to there, a
    // twelfth of the 12% period per stop, and the CSS colour is that stop's.
    const s0 = cssLine(133, { size: [3, 1], position: [0.5, 0.5] }, [0.3, 0.6]);
    const t0 = gradientT(layer, [0.3, 0.6]);
    layer.source.stops.forEach((color, k) => {
      const s = s0 + (k / 8 - t0) * 0.12;
      const want = colorAt(bands, ((s % 0.12) + 0.12) % 0.12);
      color.forEach((v, i) => expect(v, `stop ${k}`).toBeCloseTo(want[i], 9));
    });
  });
});

describe('linear', () => {
  /** The DSL's linear source: t clamped, stops evenly from 0 to 1. */
  const dslColor = (stops: RGB[], t: number): RGB => {
    const scaled = Math.min(1, Math.max(0, t)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(scaled));
    const f = scaled - i;
    return stops[i].map((v, c) => v + (stops[i + 1][c] - v) * f) as RGB;
  };

  it('spans its first CSS stop to its last, at every point, in every box', () => {
    const band = [stop(BLACK, 24), stop(hex('#797979'), 30), stop(BLACK, 36)];
    for (const angle of [0, 45, 225]) {
      for (const box of BOXES) {
        const layer = linear(angle, band, box);
        for (const at of POINTERS) {
          for (const uv of POINTS) {
            const want = (cssLine(angle, evaluate(box, at), uv) - 0.24) / 0.12;
            expect(gradientT(layer, uv, at)).toBeCloseTo(want, 9);
          }
        }
      }
    }
  });

  it('reaches a neighbouring tile when told to', () => {
    const band = [stop(BLACK, 24), stop(hex('#797979'), 30), stop(BLACK, 36)];
    const box = {
      size: [3, 3] as [number, number],
      position: [CENTER, fixed(-0.65)] as [PointerDriven, PointerDriven],
    };
    const above = linear(0, band, { ...box, tile: [0, -1] });
    const plain = { size: box.size, position: [0.5, -0.65] as [number, number] };
    for (const uv of POINTS) {
      const want = (cssLine(0, { ...plain, tile: [0, -1] }, uv) - 0.24) / 0.12;
      expect(gradientT(above, uv)).toBeCloseTo(want, 9);
      // A tile up is a whole image further along a 0deg line, which runs up: s falls by
      // 1, and t by 1 / 0.12, the band's own span.
      expect(gradientT(above, uv) - gradientT(linear(0, band, box), uv)).toBeCloseTo(-1 / 0.12, 9);
    }
  });

  it('reproduces uneven stops exactly when they fall on its 8-stop grid', () => {
    // poke-ball-holo's grey: 15%, 45%, 55%, 85% are all on the 10% grid from 15% to 85%
    const greys = [
      stop(grey(0.4), 15),
      stop(grey(0.2), 45),
      stop(grey(0.2), 55),
      stop(grey(0.4), 85),
    ];
    const layer = linear(45, greys, { size: [2, 1], position: [CENTER, CENTER] });
    if (layer.source.kind !== 'linear') throw new Error('not linear');
    for (let s = 0.15; s <= 0.85; s += 0.0137) {
      const got = dslColor(layer.source.stops, (s - 0.15) / 0.7);
      got.forEach((v, i) => expect(v).toBeCloseTo(colorAt(greys, s)[i], 9));
    }
  });
});

describe('radial', () => {
  it('reaches from the reference’s centre to its image’s farthest corner, as CSS’s does', () => {
    // COVER, and the placed and stretched images the ports draw radials in
    const boxes: Array<{ size: [number, number]; position: [PointerDriven, PointerDriven] }> = [
      { size: [1, 1], position: [CENTER, CENTER] },
      { size: [2, 1], position: [BACKGROUND_X, BACKGROUND_Y] },
      { size: [1.2, 1.5], position: [CENTER, CENTER] },
    ];
    for (const box of boxes) {
      const layer = radial(DARK_RADIAL, box, grey(0.5));
      for (const at of POINTERS) {
        const plain: PlainBox = {
          size: box.size,
          position: [valueAt(box.position[0], at, 0), valueAt(box.position[1], at, 0)],
        };
        const pointer: [number, number] = [at.fromLeft ?? 0, at.fromTop ?? 0];
        for (const uv of POINTS) {
          const where = `${JSON.stringify(box.size)} at ${JSON.stringify(at)}, ${uv}`;
          expect(radialT(layer, uv, at), where).toBeCloseTo(cssRadial(plain, pointer, uv), 9);
        }
      }
    }
  });

  it('grows its radius as the pointer leaves the middle, as the DSL’s fixed one never did', () => {
    const layer = radial([stop(WHITE, 0), stop(BLACK, 100)]);
    // the same point, a quarter-card from the pointer, sits nearer the centre of
    // a larger circle once the pointer has left the middle for a corner
    const middle = radialT(layer, [0.75, 0.5], { fromLeft: 0.5, fromTop: 0.5 });
    const corner = radialT(layer, [0.25, 0], { fromLeft: 0, fromTop: 0 });
    expect(corner).toBeLessThan(middle);
  });

  it('places stops on the fewest even positions that hold them, else samples 8', () => {
    const exact = radial([stop(WHITE, 0), stop(BLACK, 100)]);
    if (exact.source.kind !== 'radial-pointer') throw new Error('not radial');
    expect(exact.source.stops).toEqual([
      { at: 0, color: WHITE },
      { at: 1, color: BLACK },
    ]);
    const sampled = radial([stop(WHITE, 5), stop(BLACK, 120)]);
    if (sampled.source.kind !== 'radial-pointer') throw new Error('not radial');
    expect(sampled.source.stops).toHaveLength(8);
    expect(sampled.source.stops[0].color).toEqual(WHITE);
    // at the radius, 95 of the 115 points from white to black
    expect(sampled.source.stops[7].color[0]).toBeCloseTo(1 - 0.95 / 1.15, 9);
  });

  it('folds a stop’s alpha toward the neutral its blend ignores, and refuses without one', () => {
    const layer = radial(DARK_RADIAL, undefined, grey(0.5));
    if (layer.source.kind !== 'radial-pointer') throw new Error('not radial');
    // at the pointer, inside the first stop: black at 10% over the neutral 0.5
    expect(layer.source.stops[0].color).toEqual(grey(0.5 * 0.9));
    expect(() => radial(DARK_RADIAL)).toThrow();
  });
});

describe('texture', () => {
  it('lines the image up with the card as background-position does', () => {
    const width = pxWide(500);
    const layer = texture('grain', { size: [width, 1], position: [CENTER, CENTER] });
    for (const u of [0, 0.25, 0.5, 1]) {
      // the card's x in the image's own 0..1: past its left edge, (1 - width) * 50%
      const want = (u - (1 - width) * 0.5) / width;
      const [size] = layer.size ?? [1, 1];
      expect(u * size + valueAt(layer.offset?.x, {}, 0)).toBeCloseTo(want, 9);
    }
  });
});

describe('filters', () => {
  it('filterRGB is the shader’s applyFilter', () => {
    // (0.8 * 0.5 - 0.5) * 2 + 0.5, and (0.3 * 0.5 - 0.5) * 2 + 0.5 clamped up from -0.2
    for (const v of filterRGB(grey(0.8), { brightness: 0.5, contrast: 2 })) {
      expect(v).toBeCloseTo(0.3, 12);
    }
    expect(filterRGB(grey(0.3), { brightness: 0.5, contrast: 2 })).toEqual(grey(0));
    const l = 0.299 * 0.6 + 0.587 * 0.4 + 0.114 * 0.2;
    filterRGB([0.6, 0.4, 0.2], { saturate: 0 }).forEach((v) => expect(v).toBeCloseTo(l, 12));
  });

  it('composeFilters equals one filter then the other', () => {
    const inner = { brightness: fixed(1.2), contrast: fixed(0.8), saturate: fixed(1.5) };
    const outer = { brightness: fixed(0.9), contrast: fixed(1.3), saturate: fixed(0.8) };
    const both = composeFilters(inner, outer);
    const plain = (f: typeof inner) => ({
      brightness: f.brightness.base,
      contrast: f.contrast.base,
      saturate: f.saturate.base,
    });
    for (const c of [grey(0.4), [0.45, 0.5, 0.55] as RGB, [0.6, 0.5, 0.4] as RGB]) {
      const want = filterRGB(filterRGB(c, plain(inner)), plain(outer));
      const got = filterRGB(c, {
        brightness: valueAt(both.brightness),
        contrast: valueAt(both.contrast),
        saturate: valueAt(both.saturate),
      });
      got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 9));
    }
  });

  it('composeFilters is exact where --pointer-from-center is 0 or 1 when brightness follows it', () => {
    const driven = { base: 0.5, fromCenter: 0.4 };
    const inner = { brightness: driven, contrast: fixed(1.66) };
    const outer = { brightness: driven, contrast: fixed(2.5), saturate: fixed(0.66) };
    const both = composeFilters(inner, outer);
    for (const fromCenter of [0, 1]) {
      const b = 0.5 + 0.4 * fromCenter;
      for (const c of [grey(0.7), grey(0.9), [0.8, 0.85, 0.9] as RGB]) {
        const want = filterRGB(filterRGB(c, { brightness: b, contrast: 1.66 }), {
          brightness: b,
          contrast: 2.5,
          saturate: 0.66,
        });
        const got = filterRGB(c, {
          brightness: valueAt(both.brightness, { fromCenter }),
          contrast: valueAt(both.contrast, { fromCenter }),
          saturate: valueAt(both.saturate, { fromCenter }),
        });
        got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 9));
      }
    }
  });

  it('neutralBefore is the grey a filter turns into the target', () => {
    const f = { brightness: 2, contrast: 0.5, saturate: 0.75 };
    expect(filterRGB(grey(neutralBefore(f, 0.5)), f)[0]).toBeCloseTo(0.5, 12);
  });
});

describe('stand-in layers', () => {
  /** Run x up through layers of solid colour with the TypeScript blend twins. */
  const run = (x: RGB, layers: ReturnType<typeof affineLayers>) =>
    layers.reduce((acc, layer) => {
      if (layer.source.kind !== 'solid') throw new Error('not solid');
      return blendRGB(layer.blend, acc, layer.source.color);
    }, x);

  it('affineLayers maps x to scale * x + offset', () => {
    for (const v of [0, 0.25, 0.5, 0.8, 1]) {
      // contrast(.75) as CSS writes it
      expect(run(grey(v), affineLayers(0.75, 0.125))[0]).toBeCloseTo((v - 0.5) * 0.75 + 0.5, 12);
    }
  });

  it('radialMask keeps the stack where the mask is opaque and turns it to the neutral where not', () => {
    const [keep, back] = radialMask([stop(BLACK, 30, 0), stop(BLACK, 100, 1)], 0.25);
    if (keep.source.kind !== 'radial-pointer' || back.source.kind !== 'radial-pointer') {
      throw new Error('not radial');
    }
    const [kept, added] = [keep.source.stops, back.source.stops];
    const stack = grey(0.9);
    const at = (i: number) =>
      blendRGB(back.blend, blendRGB(keep.blend, stack, kept[i].color), added[i].color)[0];
    expect(at(0)).toBeCloseTo(0.25, 12); // at the pointer, transparent: the neutral
    expect(at(kept.length - 1)).toBeCloseTo(0.9, 12); // at 100%: the stack
    expect(radialMask([stop(BLACK, 30, 0), stop(BLACK, 100, 1)], 0)).toHaveLength(1);
  });
});
