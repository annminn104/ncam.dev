import type { Effect } from '../shader/types';
import {
  BACKGROUND_Y,
  BLACK,
  CENTER,
  COVER,
  SUNPILLAR,
  WHITE,
  filterRGB,
  fixed,
  grey,
  hsl,
  plus,
  radial,
  repeatingLinear,
  stop,
  times,
  BACKGROUND_X,
  type CssStop,
  type RGB,
} from './css';

/**
 * A Scarlet & Violet or Mega `Rare`, printed holo, ported from
 * pokemon-cards-151's regular-holo.css (its `rare holo`: CardProxy rewrites an
 * SV `Rare` to `Rare Holo` before it chooses). pokemon-cards-css's own
 * regular-holo, the scanlines, stays with the older cards; this is the 151
 * sequel's (css.ts has the conversions and the approximations every port
 * shares).
 *
 * The shine is one isolated group: its holo, the :before's bars multiplied
 * onto it and the :after's radial setting its luminosity, through the shine's
 * filter, overlaid onto the card. Multiply is commutative, so the group is one
 * stack here: the two bar sets screened together first, the holo multiplied
 * onto them, then the radial. The glare has no z-index in regular-holo.css, so
 * it paints beneath the shine (base.css's z-index: 3).
 *
 * Approximations:
 * - The bars' tilt, ±0.25 of the card's rotation, is fixed at the card at
 *   rest. The second set's image is placed so that the tile above it reaches
 *   the card; the seam between the two tiles is ignored.
 * - The :before's own filter is baked into each bar set before they are
 *   screened together, where the reference filters their screen: exact where
 *   the two sets do not cross, as they mostly do not.
 * - The :after's radial is more transparent than opaque between about 15% and
 *   40% of its radius, where a luminosity blend with alpha keeps the group's
 *   own luminance; the DSL has no alpha, and its stops fold toward black, so
 *   that ring darkens the bars more than the reference does.
 * - The glare's :after is clipped to the art window on a stage or trainer
 *   card in the reference; here it is never clipped.
 */

/** var(--holo), seven times over: every 14.58% runs --sunpillar-1 to 6 and back, then holds 1 */
const HOLO = [...SUNPILLAR, SUNPILLAR[0], SUNPILLAR[0]].map((color, i) =>
  stop(color, (100 / 48) * i),
);

/** The :before's filter: brightness(1) contrast(2) saturate(.75). */
const BARS_FILTER = { brightness: 1, contrast: 2, saturate: 0.75 };

/**
 * One set of bars at --bars: 5%, after the :before's filter: --bar-bg (black)
 * at 12.5%, --bar-color (70% grey) at 16.25% and 18.75%, and between them a
 * 75% grey at half alpha, folded toward the white a multiply leaves alone.
 */
const bar = (color: RGB, at: number, alpha = 1): CssStop => {
  const filtered = filterRGB(color, BARS_FILTER);
  return stop(filtered.map((c) => 1 - alpha + alpha * c) as RGB, at);
};
const BARS = [
  bar(BLACK, 12.5),
  bar(grey(0.7), 16.25),
  bar(grey(0.75), 17.5, 0.5),
  bar(grey(0.7), 18.75),
  bar(BLACK, 22.5),
  bar(BLACK, 40),
];

/** The :after's filter, brightness(1) contrast(3), then its alpha folded toward black (see above). */
const afterStop = (c: RGB, at: number, alpha: number) =>
  stop(filterRGB(c, { brightness: 1, contrast: 3, saturate: 1 }), at, alpha);

/** The glare's :after's filter, brightness(.6) contrast(3); its alpha folds toward overlay's 0.5. */
const glareAfterStop = (c: RGB, at: number, alpha: number) =>
  stop(filterRGB(c, { brightness: 0.6, contrast: 3, saturate: 1 }), at, alpha);

export const svRareHolo: Effect = {
  id: 'sv-rare-holo',
  beneath: [
    {
      // .card__glare's radial and its :after, overlaid onto it inside its group
      layers: [
        {
          ...radial(
            [stop(WHITE, 10, 0.8), stop(WHITE, 20, 0.65), stop(BLACK, 120, 0.5)],
            COVER,
            grey(0.5),
          ),
          blend: 'normal',
        },
        {
          ...radial(
            [
              glareAfterStop(hsl(180, 100, 95), 5, 1),
              glareAfterStop(grey(0.39), 55, 0.25),
              glareAfterStop(hsl(205.6, 50, 90), 110, 0.5),
            ],
            COVER,
            grey(0.5),
          ),
          blend: 'overlay',
        },
      ],
      // calc(var(--card-opacity) * .8); filter: none
      opacity: { base: 0.8 },
      mixBlend: 'overlay',
    },
  ],
  shine: [
    {
      layers: [
        // the :before, background-image bottom first: the bars at `50%
        // calc(var(--background-y) * -1.2)`, reaching the card from the tile above
        {
          ...repeatingLinear(0, BARS, {
            size: [2, 2],
            position: [CENTER, times(BACKGROUND_Y, -1.2)],
            tile: [0, -1],
          }),
          blend: 'normal',
        },
        // and the bars at `50% calc(var(--background-y) * 1.2)`, screened over them
        {
          ...repeatingLinear(0, BARS, {
            size: [2, 2],
            position: [CENTER, times(BACKGROUND_Y, 1.2)],
          }),
          blend: 'screen',
        },
        // the shine's own holo, at `calc((50% - var(--background-x)) + 50%)`
        // and the same in y, which the :before multiplies onto
        {
          ...repeatingLinear(10, HOLO, {
            size: [4, 4],
            position: [
              plus(fixed(1), times(BACKGROUND_X, -1)),
              plus(fixed(1), times(BACKGROUND_Y, -1)),
            ],
          }),
          blend: 'multiply',
        },
        // the :after: the group takes this radial's luminosity
        {
          ...radial(
            [
              afterStop(grey(0.9), 0, 0.8),
              afterStop(grey(0.78), 25, 0.1),
              afterStop(grey(0.35), 90, 1),
            ],
            COVER,
            BLACK,
          ),
          blend: 'luminosity',
        },
      ],
      filter: { brightness: { base: 1.25 }, contrast: { base: 3 }, saturate: { base: 0.75 } },
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
