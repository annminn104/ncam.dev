import type { Effect } from '../shader/types';
import { TEXTURE_SIZE } from '../textures';
import {
  BLACK,
  CENTER,
  COVER,
  POINTER_X,
  POINTER_Y,
  autoHeight,
  exactConic,
  exactLinear,
  exactRadial,
  fixed,
  fixedFilter,
  grey,
  hsl,
  nudged,
  pxTall,
  pxWide,
  radial,
  stop,
  sunpillarClr,
  texture,
} from './css';
import { glareNeutral } from './legacy-glare';

/** secret-rare.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1.3, contrast: 1.5 };

/** --glittersize: 25% of the card each way. */
const GLITTER: [number, number] = [0.25, 0.25];

/** .card__shine's own sunpillars: base.css starts --sunpillar-clr-1 at --sunpillar-1. */
const [S1, , , S4, S5, S6] = sunpillarClr(1);

/**
 * A secret rare, ported from pokemon-cards-css's secret-rare.css on its
 * unmasked path (css.ts has the conversions): one group — the sunpillars'
 * conic overlaid on a dark radial under two glitters — with a gold `:before`
 * (geometric, the unmasked --foil, hard-lit on a gold linear multiplied onto a
 * pale radial, lightened at 80%) and a glitter `:after`, overlaid, the whole
 * colour-dodged through the unmasked filter. The glare is ported too,
 * hard-lit beneath the shine (legacy-glare.ts).
 *
 * Approximations:
 * - The glitter and geometric sheets are drawn here (textures.ts), not the
 *   reference's images.
 * - --shift's 1px is at CARD_PX.
 */
export const secretRare: Effect = {
  id: 'secret-rare',
  shine: [
    {
      layers: [
        { ...exactRadial([stop(BLACK, 10, 0.98), stop(grey(0.95), 90, 0.15)]), blend: 'normal' },
        {
          ...exactConic([stop(S4, 0), stop(S5, 25), stop(S6, 50), stop(S1, 75), stop(S4, 100)]),
          blend: 'overlay',
        },
        {
          ...texture('glitter', { size: GLITTER, position: [fixed(0.55), fixed(0.55)] }),
          blend: 'hard-light',
        },
        {
          ...texture('glitter', { size: GLITTER, position: [fixed(0.45), fixed(0.45)] }),
          blend: 'soft-light',
        },
      ],
      children: [
        {
          // :before
          layers: [
            {
              ...exactRadial([stop(hsl(10, 20, 90), 10, 0.95), stop(BLACK, 70)]),
              blend: 'normal',
            },
            {
              ...exactLinear(45, [stop(hsl(46, 95, 50), 0), stop(hsl(52, 100, 69), 100)]),
              blend: 'multiply',
            },
            {
              ...texture('geometric', {
                size: autoHeight(0.33, TEXTURE_SIZE.geometric),
                position: [CENTER, CENTER],
              }),
              blend: 'hard-light',
            },
          ],
          filter: fixedFilter({ brightness: 1.25, contrast: 1.25, saturate: 0.35 }),
          mixBlend: 'lighten',
          opacity: fixed(0.8),
        },
        {
          // :after
          layers: [
            {
              ...texture('glitter', {
                size: GLITTER,
                position: [
                  nudged(POINTER_X, pxWide(1), GLITTER[0]),
                  nudged(POINTER_Y, pxTall(1), GLITTER[1]),
                ],
              }),
              blend: 'normal',
            },
          ],
          filter: {
            brightness: { base: 0.6, fromCenter: 0.6 },
            contrast: fixed(1.5),
            saturate: fixed(1),
          },
          mixBlend: 'overlay',
        },
      ],
      filter: {
        brightness: { base: 0.2, fromCenter: 0.3 },
        contrast: fixed(2),
        saturate: fixed(0.75),
      },
      mixBlend: 'color-dodge',
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(hsl(45, 8, 80), 0, 0.3), stop(hsl(22, 15, 12), 180)],
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
