import type { Effect, PointerDriven } from '../shader/types';
import {
  BACKGROUND_X,
  BACKGROUND_Y,
  BLACK,
  COVER,
  exactRadial,
  exactRepeatingLinear,
  filterRGB,
  fixed,
  fixedFilter,
  gradientLengthPx,
  grey,
  hex,
  hsl,
  plus,
  radial,
  stop,
  times,
  type CssBox,
  type RGB,
} from './css';
import { BASE_GLARE, glareNeutral } from './legacy-glare';

/** regular-holo.css's .card__glare filter, and its :after's own. */
const GLARE_FILTER = { brightness: 0.8, contrast: 1.5 };
const AFTER_FILTER = { brightness: 0.6, contrast: 3 };
const afterStop = (c: RGB, at: number, alpha = 1) => stop(filterRGB(c, AFTER_FILTER), at, alpha);

/** cards.css's --violet, --blue, --green, --yellow and --red. */
const SPECTRUM = [hex('#c929f1'), hex('#0dbde9'), hex('#21e985'), hex('#eedf10'), hex('#f80e35')];

/**
 * The scanlines, black then #666, a --scanlines-space (1px, as the reference
 * computes it; the .5px the file also sets is not what it draws) each twice
 * over, as a share of the card's 90° line at CARD_PX.
 */
const SCANLINE = (1 / gradientLengthPx(90, COVER)) * 100;
const SCANLINES = [
  stop(BLACK, 0),
  stop(BLACK, 2 * SCANLINE),
  stop(hex('#666666'), 2 * SCANLINE),
  stop(hex('#666666'), 4 * SCANLINE),
];

/** --bar-bg black and --bar-color hsla(0, 0%, 70%, 1), at --bars (3%) steps, to `end`. */
const bars = (end: number) => [
  stop(BLACK, 6),
  stop(grey(0.7), 9),
  stop(BLACK, 10.5),
  stop(grey(0.7), 12),
  stop(BLACK, 15),
  stop(BLACK, end),
];

/** `calc(((50% - var(--background-x)) * k) + 50%)`, and the like: 0.5 - k · (p - 0.5). */
const against = (p: PointerDriven, k: number): PointerDriven =>
  plus(fixed(0.5 + 0.5 * k), times(p, -k));

/** The two bar images, 200% of the card, moving against --background and across it. */
const BARS_TOP: CssBox = {
  size: [2, 2],
  position: [plus(against(BACKGROUND_X, 1.65), times(BACKGROUND_Y, 0.5)), BACKGROUND_X],
};
const BARS_BOTTOM: CssBox = {
  size: [2, 2],
  position: [plus(against(BACKGROUND_X, -0.9), times(BACKGROUND_Y, -0.75)), BACKGROUND_Y],
};

/**
 * Rare Holo, ported from pokemon-cards-css's regular-holo.css (css.ts has the
 * conversions): the spectrum's bands overlaid on scanlines, with a `:before`
 * of bars screened together and hard-lit, and an `:after` radial in
 * luminosity, the group colour-dodged inside the card's own region. The glare
 * is ported too: base.css's radial and an :after radial overlaid onto it,
 * under the glare's own filter, painted beneath the shine (legacy-glare.ts).
 *
 * Approximations:
 * - The scanlines' 1px is at CARD_PX, so they are drawn at the card's size.
 * - The reference clips the glare's :after to the art window on stage,
 *   supporter and item cards; here it covers the card.
 */
export const regularHolo: Effect = {
  id: 'regular-holo',
  shine: [
    {
      layers: [
        { ...exactRepeatingLinear(90, SCANLINES, COVER), blend: 'normal' },
        {
          ...exactRepeatingLinear(
            110,
            [...SPECTRUM, ...SPECTRUM, ...SPECTRUM].map((c, i) => stop(c, (100 * i) / 14)),
            { size: [4, 4], position: [against(BACKGROUND_X, 2.6), against(BACKGROUND_Y, 3.5)] },
          ),
          blend: 'overlay',
        },
      ],
      children: [
        {
          // :before
          layers: [
            { ...exactRepeatingLinear(90, bars(30), BARS_BOTTOM), blend: 'normal' },
            { ...exactRepeatingLinear(90, bars(42), BARS_TOP), blend: 'screen' },
          ],
          filter: fixedFilter({ brightness: 1.15, contrast: 1.1 }),
          mixBlend: 'hard-light',
        },
        {
          // :after
          layers: [
            {
              ...exactRadial([stop(grey(0.9), 0, 0.8), stop(grey(0.78), 25, 0.1), stop(BLACK, 90)]),
              blend: 'normal',
            },
          ],
          filter: fixedFilter({ brightness: 0.6, contrast: 4 }),
          mixBlend: 'luminosity',
        },
      ],
      filter: fixedFilter({ brightness: 1.1, contrast: 1.1, saturate: 1.2 }),
      mixBlend: 'color-dodge',
    },
  ],
  beneath: [
    {
      layers: [
        // .card__glare paints base.css's radial
        { ...radial(BASE_GLARE, COVER, glareNeutral('overlay', GLARE_FILTER)), blend: 'normal' },
        // and its :after, under its own filter, overlaid onto it
        {
          ...radial(
            [
              afterStop(hsl(180, 100, 95), 5),
              afterStop(grey(0.39), 55, 0.25),
              afterStop(BLACK, 110, 0.36),
            ],
            COVER,
            grey(0.5),
          ),
          blend: 'overlay',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      opacity: { base: 0.8 },
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
