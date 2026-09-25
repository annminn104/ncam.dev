import type { Effect, PointerDriven } from '../shader/types';
import { TEXTURE_SIZE } from '../textures';
import {
  BACKGROUND_X,
  BACKGROUND_Y,
  CENTER,
  COVER,
  POINTER_X,
  POINTER_Y,
  WHITE,
  autoHeight,
  exactRadial,
  exactRepeatingLinear,
  fixed,
  fixedFilter,
  glowStop,
  gradientLengthPx,
  grey,
  hsl,
  plus,
  radial,
  stop,
  texture,
  times,
  type CssBox,
  type CssStop,
} from './css';
import { glareNeutral } from './legacy-glare';

/** radiant-holo.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1, contrast: 1.5 };

/** --barwidth, as a percentage of the gradient line. */
const BARWIDTH = 1.2;
/** Each bar's grey, one --barwidth apiece. */
const BAR_GREYS = [0.1, 0.2, 0.35, 0.425, 0.5, 0.425, 0.35, 0.2, 0.1, 0];

/**
 * The bars exactly as the CSS writes them: 10% grey at 0% and 1%, then each
 * grey held for one --barwidth, starting 0.01% after the last one ends.
 */
function bars(): CssStop[] {
  const stops = [stop(grey(0.1), 0), stop(grey(0.1), 1)];
  BAR_GREYS.forEach((g, i) => {
    if (i > 0) stops.push(stop(grey(g), BARWIDTH * i + 0.01));
    stops.push(stop(grey(g), BARWIDTH * (i + 1)));
  });
  return stops;
}

/** `calc(((var(--background-x) - 50%) * k) + 50%)` */
const around = (p: PointerDriven, k: number): PointerDriven =>
  plus(times(p, k), fixed(0.5 - 0.5 * k));

/** Both bar images: 210% of the card, moving half as far again as --background. */
const BARS: CssBox = {
  size: [2.1, 2.1],
  position: [around(BACKGROUND_X, 1.5), around(BACKGROUND_Y, 1.5)],
};

/** `at calc((var(--pointer-x) * 0.5) + 25%) …`: the ellipses follow the pointer half as far. */
const HALFWAY: [PointerDriven, PointerDriven] = [
  plus(fixed(0.25), times(POINTER_X, 0.5)),
  plus(fixed(0.25), times(POINTER_Y, 0.5)),
];

/** :after's rainbow: 400% × 100%, running 2.5 times as far as --background, the other way. */
const RAINBOW: CssBox = {
  size: [4, 1],
  position: [around(BACKGROUND_X, -2.5), around(BACKGROUND_Y, -2.5)],
};
/** --space: 200px, as a percentage of that rainbow's 55° line at CARD_PX. */
const SPACE = (200 / gradientLengthPx(55, RAINBOW)) * 100;
const RAINBOW_STOPS: CssStop[] = [
  hsl(3, 95, 85),
  hsl(207, 100, 84),
  hsl(29, 100, 85),
  hsl(160, 100, 86),
  hsl(309, 94, 87),
  hsl(188, 95, 85),
  hsl(3, 95, 85),
].map((color, i) => stop(color, SPACE * (i + 1)));

/**
 * A radiant rare, ported from pokemon-cards-css's radiant-holo.css on its
 * unmasked path (css.ts has the conversions): grey bars crossed at ±45°,
 * darkened together, under an ellipse of near-white running out to the card's
 * type glow (--card-glow, the shader's uCardGlow), excluded; then its `:after`
 * (trainerbg, the unmasked --foil, differenced onto a pastel rainbow,
 * colour-dodged, kept to the art window) and, above that by z-index, its
 * `:before` (glitter dodged onto a dark ellipse, overlaid), the whole group
 * colour-dodged inside the card's borders. The glare is ported too, hard-lit
 * beneath the shine (legacy-glare.ts).
 *
 * Approximations:
 * - trainerbg and glitter are drawn here (textures.ts), not the reference's
 *   images.
 * - --space's 200px is at CARD_PX.
 */
export const radiantHolo: Effect = {
  id: 'radiant-holo',
  shine: [
    {
      layers: [
        { ...exactRepeatingLinear(-45, bars(), BARS), blend: 'normal' },
        { ...exactRepeatingLinear(45, bars(), BARS), blend: 'darken' },
        {
          ...exactRadial([stop(grey(0.95), 20), glowStop(130)], COVER, {
            at: HALFWAY,
            ellipse: true,
          }),
          blend: 'exclusion',
        },
      ],
      children: [
        {
          // :after (z-index auto), in the art window
          layers: [
            { ...exactRepeatingLinear(55, RAINBOW_STOPS, RAINBOW), blend: 'normal' },
            {
              ...texture('trainerbg', {
                size: autoHeight(0.25, TEXTURE_SIZE.trainerbg),
                position: [CENTER, CENTER],
              }),
              blend: 'difference',
            },
          ],
          filter: fixedFilter({ brightness: 0.6, contrast: 3, saturate: 2 }),
          mixBlend: 'color-dodge',
          clip: 'regular',
        },
        {
          // :before (z-index 2)
          layers: [
            {
              ...exactRadial(
                [stop(grey(0.58), 10, 0.8), stop(grey(0.2), 20, 0.9), stop(grey(0.2), 50, 0.5)],
                { size: [3.5, 3.5], position: [CENTER, CENTER] },
                { at: HALFWAY, ellipse: true },
              ),
              blend: 'normal',
            },
            {
              ...texture('glitter', { size: [0.15, 0.15], position: [CENTER, CENTER] }),
              blend: 'color-dodge',
            },
          ],
          filter: fixedFilter({ brightness: 0.66, contrast: 2, saturate: 0.5 }),
          mixBlend: 'overlay',
        },
      ],
      filter: fixedFilter({ brightness: 0.5, contrast: 2, saturate: 1.75 }),
      mixBlend: 'color-dodge',
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(WHITE, 0, 0.33), stop(grey(0.25), 110)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
