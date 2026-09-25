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
import { GLITTERSIZE, glitter } from './rainbow-family';

/**
 * trainer-gallery-secret-rare.css's .card__glare filter for a card with no
 * mask: its `:not(.masked)` rule's brightness(.5) contrast(1), more specific
 * than the brightness(1) the gallery rule sets.
 */
const GLARE_FILTER = { brightness: 0.5, contrast: 1 };

/** The :after's --sunpillar-clr-4, 5, 6, 1, 2, 3, 4, spread evenly around its conic. */
const CLR = sunpillarClr(6);
const CONIC = [CLR[3], CLR[4], CLR[5], CLR[0], CLR[1], CLR[2], CLR[3]].map((color, i) =>
  stop(color, (100 * i) / 6),
);

/**
 * A trainer gallery secret rare, ported from pokemon-cards-css's
 * trainer-gallery-secret-rare.css on its unmasked path: two glitters, soft-lit
 * and darkening, over a radial in `color` onto a gold linear; a `:before` of
 * geometric, the unmasked --foil, colour-burnt onto a pale radial, excluded;
 * and an `:after` of glitter in luminosity over a conic of the sunpillars,
 * soft-lit; the group colour-dodged over the whole card. The glare is ported
 * too, beneath the shine (legacy-glare.ts).
 *
 * Approximations: glitter and geometric are drawn here (textures.ts), not the
 * reference's images; --shift's 1px is at CARD_PX.
 */
export const trainerGallerySecretRare: Effect = {
  id: 'trainer-gallery-secret-rare',
  shine: [
    {
      layers: [
        {
          ...exactLinear(45, [stop(hsl(46, 95, 50), 0), stop(hsl(52, 100, 69), 100)]),
          blend: 'normal',
        },
        {
          ...exactRadial([
            stop(hsl(152.7, 21.6, 10), 10),
            stop(hsl(177, 22, 80), 50, 0.1),
            stop(grey(0.95), 90, 0.98),
          ]),
          blend: 'color',
        },
        { ...glitter([fixed(0.55), fixed(0.55)]), blend: 'darken' },
        { ...glitter([fixed(0.4), fixed(0.45)]), blend: 'soft-light' },
      ],
      children: [
        {
          // :before
          layers: [
            {
              ...exactRadial([
                stop(hsl(50, 20, 90), 10, 0.95),
                stop(hsl(324, 22, 63), 50, 0.5),
                stop(BLACK, 90),
              ]),
              blend: 'normal',
            },
            {
              ...texture('geometric', {
                size: autoHeight(0.33, TEXTURE_SIZE.geometric),
                position: [CENTER, CENTER],
              }),
              blend: 'color-burn',
            },
          ],
          filter: fixedFilter({ brightness: 1, contrast: 1, saturate: 1 }),
          mixBlend: 'exclusion',
        },
        {
          // :after, its glitter where secret-rare.css's :after puts it
          layers: [
            { ...exactConic(CONIC), blend: 'normal' },
            {
              ...glitter([
                nudged(POINTER_X, pxWide(1), GLITTERSIZE),
                nudged(POINTER_Y, pxTall(1), GLITTERSIZE),
              ]),
              blend: 'luminosity',
            },
          ],
          filter: {
            brightness: { base: 0.6, fromCenter: 0.5 },
            contrast: fixed(2),
            saturate: fixed(3),
          },
          mixBlend: 'soft-light',
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
            [stop(hsl(40, 100, 95), 10, 0.2), stop(hsl(40, 20, 5), 180)],
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
