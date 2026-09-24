import type { Effect, Element } from '../shader/types';
import {
  AT_BACKGROUND,
  BACKGROUND_X,
  BACKGROUND_Y,
  BLACK,
  CENTER,
  COVER,
  DARK_RADIAL,
  POINTER_X,
  POINTER_Y,
  SUNPILLAR_VAR,
  WHITE,
  composeFilters,
  fixed,
  fixedFilter,
  grey,
  hex,
  hsl,
  linear,
  neutralBefore,
  pxTall,
  pxWide,
  radial,
  radialMask,
  repeatingLinear,
  stop,
  sunpillarClr,
  sunpillarStops,
  texture,
  times,
  type CssBox,
  type FixedFilter,
} from './css';

/**
 * Double Rare, the standard-layout ex, ported from pokemon-cards-151's
 * ex-regular.css (css.ts has the conversions and the approximations every
 * port shares). The reference confines all but its glare to the card's own
 * foil mask. There are no masks here; select.ts's clip region stands in, and
 * for this rarity it must not be the whole card.
 *
 * Approximations:
 * - .card__shine has no background of its own. Its :before and :after are all
 *   of it, and they blend inside its isolated group: the :before over nothing,
 *   so its `lighten` changes nothing, the :after `difference`d onto the
 *   :before. Only the group reaches the card, through the shine's filter and
 *   color-dodge. The DSL has no groups, so each pseudo-element becomes an
 *   element that color-dodges onto the card through its own filter and then
 *   the shine's, composed into one. Where the two's bands cross, the
 *   difference would have darkened them; here both dodge.
 * - --birthday-dank2 is a second sheet. Our one birthday sheet stands in for
 *   both, at their two sizes.
 * - The glitter's mask is its radial alone: the --mask it intersects with is
 *   dropped, and the radial is spelt as layers (css.ts#radialMask).
 */

const ANGLE = 133; // --angle
const BANDS = [
  stop(hex('#0e1221'), 0),
  stop(hsl(180, 10, 60), 2.8),
  stop(hsl(180, 20.9, 82.2), 3.5),
  stop(hsl(180, 10, 60), 4.2),
  stop(hex('#0e1221'), 7),
  stop(hex('#0e1221'), 12),
];

/** base.css's .card__shine filter; ex-regular.css leaves it be. */
const SHINE_FILTER = fixedFilter({ brightness: 0.45, contrast: 1.5, saturate: 1.2 });

interface PseudoLayout {
  /** which --sunpillar-N base.css starts this pseudo-element's --sunpillar-clr-1 on */
  clr: 5 | 6;
  grain: CssBox;
  sunpillar: CssBox;
  bands: CssBox;
  filter: FixedFilter;
}

/**
 * One of the shine's two pseudo-elements. They share one rule for their
 * layers and blends; the :after then moves and resizes them.
 */
function pseudo(layout: PseudoLayout): Element {
  return {
    // background-image bottom first. background-blend-mode `screen, hue,
    // hard-light` lists the grain, the sunpillar and the bands top first.
    layers: [
      // Black at 10-25% alpha, under a hard-light layer. Hard-light is linear
      // in its backdrop and leaves a source unchanged over 0.5 grey, so black
      // at alpha a is exactly a 0.5 * (1 - a) grey backdrop.
      {
        ...radial(DARK_RADIAL, { size: [2, 1], position: AT_BACKGROUND }, grey(0.5)),
        blend: 'normal',
      },
      { ...repeatingLinear(ANGLE, BANDS, layout.bands), blend: 'hard-light' },
      {
        ...repeatingLinear(0, sunpillarStops(sunpillarClr(layout.clr)), layout.sunpillar),
        blend: 'hue',
      },
      { ...texture('grain', layout.grain), blend: 'screen' },
    ],
    // its own filter, then the group's
    filter: composeFilters(fixedFilter(layout.filter), SHINE_FILTER),
    // the group's, standing in for its own (see above)
    mixBlend: 'color-dodge',
  };
}

const GLITTER_FILTER = { brightness: 2, contrast: 0.5, saturate: 0.75 };

export const exRegular: Effect = {
  id: 'ex-regular',
  shine: [
    // .card__glitter, beneath the shine
    {
      // background-image bottom first. background-blend-mode `darken, hue,
      // lighten` lists the radial, the sunpillar and the first sheet top first.
      layers: [
        {
          ...texture('birthday', { size: [1.2, 1.2], position: [CENTER, CENTER] }),
          blend: 'normal',
        },
        {
          ...texture('birthday', { size: [1.4, 1.4], position: [CENTER, CENTER] }),
          blend: 'lighten',
        },
        {
          // `linear-gradient(var(--angle), var(--sunpillar))`. The glitter's own
          // rule sets no --angle, so it inherits cards.css's 133deg on .card:
          // the same angle as the shine's pseudo-elements.
          ...linear(ANGLE, SUNPILLAR_VAR, { size: [5, 5], position: [POINTER_X, POINTER_Y] }),
          blend: 'hue',
        },
        {
          // The alpha stop folds toward white, which darken leaves unchanged.
          ...radial([stop(hsl(295, 100, 10), 20), stop(hsl(183, 84, 85), 100, 0.15)], COVER, WHITE),
          blend: 'darken',
        },
        // mask-image: radial-gradient(farthest-corner circle at var(--pointer-x)
        // var(--pointer-y), transparent 30%, black 100%). What it hides becomes
        // the grey the filter turns into hard-light's neutral 0.5.
        ...radialMask(
          [stop(BLACK, 30, 0), stop(BLACK, 100, 1)],
          neutralBefore(GLITTER_FILTER, 0.5),
        ),
      ],
      filter: fixedFilter(GLITTER_FILTER),
      mixBlend: 'hard-light',
    },
    // .card__shine:before
    pseudo({
      clr: 5,
      grain: { size: [pxWide(200), pxTall(200)], position: [CENTER, CENTER] },
      sunpillar: { size: [2, 7], position: [fixed(0), BACKGROUND_Y] },
      bands: { size: [3, 1], position: AT_BACKGROUND },
      filter: { brightness: 1, contrast: 1.5, saturate: 2 },
    }),
    // .card__shine:after
    pseudo({
      clr: 6,
      grain: { size: [pxWide(200), 1], position: [CENTER, CENTER] },
      sunpillar: { size: [2, 4], position: [fixed(0), BACKGROUND_Y] },
      bands: { size: [1.95, 1], position: [times(BACKGROUND_X, -1), times(BACKGROUND_Y, -1)] },
      filter: { brightness: 1.2, contrast: 1, saturate: 2 },
    }),
  ],
  glare: [
    {
      layers: [
        {
          // The alpha stop folds toward white, which color-burn leaves unchanged.
          ...radial(
            [stop(hsl(0, 0, 40), 0), stop(hsl(210, 3, 54), 63, 0.5), stop(hsl(0, 0, 30), 150)],
            COVER,
            WHITE,
          ),
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 1.5 }, contrast: { base: 2 } },
      mixBlend: 'color-burn',
      opacity: { base: 0.2, fromCenter: 1 },
    },
    {
      layers: [
        {
          // The transparent stop folds toward black, which lighten leaves unchanged.
          ...radial([stop(hsl(0, 0, 90), 10), stop(hsl(0, 0, 20), 60, 0)], COVER, BLACK),
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 1 }, contrast: { base: 1.4 } },
      mixBlend: 'lighten',
      opacity: { base: 0, fromCenter: 0.66 },
    },
  ],
};
