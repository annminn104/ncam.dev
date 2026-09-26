import type { Effect, PointerDriven } from '../shader/types';
import {
  BACKGROUND_X,
  BACKGROUND_Y,
  BLACK,
  CENTER,
  COVER,
  WHITE,
  exactRadial,
  exactRepeatingLinear,
  fixed,
  fixedFilter,
  hsl,
  radial,
  stop,
  texture,
} from './css';
import { glareNeutral } from './legacy-glare';
import { V_BANDS, sunStops } from './v-family';

/** v-max.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1, contrast: 1 };

/** v-max.css's --space. */
const SPACE = 6;

/** background-position: var(--background-x) var(--background-y) */
const AT_BACKGROUND: [PointerDriven, PointerDriven] = [BACKGROUND_X, BACKGROUND_Y];

/** The rainbow at −33°, one --space a colour. */
const RAINBOW = [
  hsl(2, 70, 47),
  hsl(228, 60, 64),
  hsl(176, 55, 39),
  hsl(123, 68, 35),
  hsl(283, 75, 57),
  hsl(2, 70, 47),
].map((color, i) => stop(color, SPACE * (i + 1)));

/** The dark bands at 133°, half transparent at their darkest. */
const DARK_BANDS = [
  stop(hsl(227, 53, 12), 0, 0.5),
  stop(hsl(180, 10, 50), 2.5),
  stop(hsl(83, 50, 35), 5),
  stop(hsl(180, 10, 50), 7.5),
  stop(hsl(227, 53, 12), 10, 0.5),
  stop(hsl(227, 53, 12), 15, 0.5),
];

/** The pastel radial about the pointer, 60% opaque. */
const PASTELS = [
  stop(hsl(189, 76, 77), 0, 0.6),
  stop(hsl(147, 59, 77), 25, 0.6),
  stop(hsl(271, 55, 69), 50, 0.6),
  stop(hsl(355, 56, 72), 75, 0.6),
];

/**
 * A VMAX, ported from pokemon-cards-css's v-max.css on its unmasked path:
 * vmaxbg, the unmasked --foil, 60% × 30% of the card, differenced onto a
 * rainbow at −33° in luminosity, onto dark bands at 133° soft-lit, onto a
 * pastel radial about the pointer, the group colour-dodged; its `:after` the V
 * family's sunpillars hue-blended onto its bands, lightened, strongest as the
 * pointer leaves the middle. The glare is ported from v-max.css, hard-lit,
 * beneath the shine (legacy-glare.ts). The reference masks the shine with the
 * card's own mask, never a clip-path; select.ts's clip region stands in: the
 * whole card less the header and the bars its masks leave out (regions.ts's
 * `swsh-vmax`, a gallery VMAX's frame too).
 *
 * Approximation: vmaxbg is drawn here (textures.ts), not the reference's
 * image.
 */
export const vMax: Effect = {
  id: 'v-max',
  shine: [
    {
      layers: [
        { ...exactRadial(PASTELS, { size: [2, 2], position: AT_BACKGROUND }), blend: 'normal' },
        {
          ...exactRepeatingLinear(133, DARK_BANDS, { size: [6, 6], position: AT_BACKGROUND }),
          blend: 'soft-light',
        },
        {
          ...exactRepeatingLinear(-33, RAINBOW, { size: [11, 11], position: AT_BACKGROUND }),
          blend: 'luminosity',
        },
        {
          ...texture('vmaxbg', { size: [0.6, 0.3], position: [CENTER, CENTER] }),
          blend: 'difference',
        },
      ],
      children: [
        {
          // :after
          layers: [
            {
              ...exactRepeatingLinear(133, V_BANDS, { size: [3, 1], position: AT_BACKGROUND }),
              blend: 'normal',
            },
            {
              ...exactRepeatingLinear(0, sunStops(6, SPACE), {
                size: [2, 7],
                position: [fixed(0), BACKGROUND_Y],
              }),
              blend: 'hue',
            },
          ],
          filter: { saturate: fixed(1.5) },
          mixBlend: 'lighten',
          // calc((0.3 * var(--card-opacity)) + var(--card-opacity) * var(--pointer-from-center) * 0.5)
          opacity: { base: 0.3, fromCenter: 0.5 },
        },
      ],
      filter: {
        brightness: { base: 0.4, fromCenter: 0.4 },
        contrast: fixed(2),
        saturate: fixed(1),
      },
      mixBlend: 'color-dodge',
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(WHITE, 0, 0.75), stop(BLACK, 120)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc((0.2 * var(--card-opacity)) + var(--card-opacity) * var(--pointer-from-center) * 0.8)
      opacity: { base: 0.2, fromCenter: 0.8 },
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
