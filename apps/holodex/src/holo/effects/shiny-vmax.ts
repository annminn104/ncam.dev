import type { Effect } from '../shader/types';
import {
  BACKGROUND_X,
  BACKGROUND_Y,
  BLACK,
  COVER,
  exactLinear,
  exactRadial,
  exactRepeatingLinear,
  filterRGB,
  fixed,
  fixedFilter,
  grey,
  hsl,
  plus,
  radial,
  stop,
  times,
  type RGB,
} from './css';
import { glareNeutral } from './legacy-glare';
import { RCLR_STOPS, glitter } from './rainbow-family';
import { sunStops } from './v-family';

/** shiny-vmax.css's filter, the same for its .card__glare and its :after. */
const GLARE_FILTER = { brightness: 1, contrast: 1.25 };
const afterStop = (c: RGB, at: number, alpha: number) =>
  stop(filterRGB(c, GLARE_FILTER), at, alpha);

/**
 * A shiny VMAX, ported from pokemon-cards-css's shiny-vmax.css on its unmasked
 * path: two glitters, soft-lit and overlaid, onto a muted rainbow at −30°
 * colour-burnt onto a radial from near-black through a clear grey to
 * near-white; a `:before` radial lightened at .35 (its --foil is `none`); and
 * an `:after` of the sunpillars differenced by shiny-rare.css's
 * `.card.card[data-rarity*="rare shiny"]` rule, which outranks shiny-vmax.css's
 * own hue. The glare is ported too, beneath the shine (legacy-glare.ts).
 *
 * Approximation: glitter is drawn here (textures.ts), not the reference's
 * image.
 */
export const shinyVmax: Effect = {
  id: 'shiny-vmax',
  shine: [
    {
      layers: [
        {
          ...exactRadial([
            stop(hsl(248, 5, 10), 10),
            stop(hsl(206, 5, 80), 50, 0.1),
            stop(grey(0.95), 90, 0.98),
          ]),
          blend: 'normal',
        },
        {
          ...exactLinear(-30, RCLR_STOPS, {
            size: [4, 4],
            position: [times(BACKGROUND_X, 1.5), times(BACKGROUND_Y, 1.5)],
          }),
          blend: 'color-burn',
        },
        { ...glitter([fixed(0.55), fixed(0.55)]), blend: 'overlay' },
        { ...glitter([fixed(0.4), fixed(0.45)]), blend: 'soft-light' },
      ],
      children: [
        {
          // :before, its --foil none
          layers: [
            {
              ...exactRadial([
                stop(hsl(248, 5, 91), 10, 0.95),
                stop(hsl(206, 5, 68), 50, 0.5),
                stop(BLACK, 120),
              ]),
              blend: 'normal',
            },
          ],
          filter: fixedFilter({ brightness: 1, contrast: 1, saturate: 0.4 }),
          mixBlend: 'lighten',
          opacity: fixed(0.35),
        },
        {
          // :after
          layers: [
            {
              ...exactRepeatingLinear(-30, sunStops(6), {
                size: [4, 8],
                position: [
                  plus(fixed(2), times(BACKGROUND_X, -3)),
                  plus(fixed(2), times(BACKGROUND_Y, -3)),
                ],
              }),
              blend: 'normal',
            },
          ],
          filter: {
            brightness: { base: 0.5, fromCenter: 0.4 },
            contrast: fixed(1.4),
            saturate: fixed(1.2),
          },
          mixBlend: 'difference',
        },
      ],
      filter: fixedFilter({ brightness: 1, contrast: 1, saturate: 0.85 }),
      mixBlend: 'color-dodge',
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [
              stop(hsl(248, 5, 90), 0, 0.45),
              stop(hsl(206, 5, 30), 45, 0.45),
              stop(BLACK, 120, 0.33),
            ],
            COVER,
            glareNeutral('overlay', GLARE_FILTER),
          ),
          blend: 'normal',
        },
        {
          // the :after, through its own filter, overlaid onto it
          ...radial(
            [
              afterStop(hsl(248, 5, 90), 0, 0.75),
              afterStop(hsl(206, 5, 30), 45, 0.65),
              afterStop(BLACK, 100, 0.75),
            ],
            COVER,
            grey(0.5),
          ),
          blend: 'overlay',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
