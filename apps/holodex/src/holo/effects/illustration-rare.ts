import { blendRGB } from '../shader/blend';
import type { Effect } from '../shader/types';
import {
  AT_BACKGROUND,
  BACKGROUND_X,
  BACKGROUND_Y,
  BLACK,
  CENTER,
  DARK_RADIAL,
  WHITE,
  filterRGB,
  fixed,
  grey,
  hex,
  hsl,
  mapStops,
  pxWide,
  radial,
  repeatingLinear,
  stop,
  sunpillarClr,
  sunpillarStops,
  texture,
  times,
} from './css';

/**
 * Illustration Rare, ported from pokemon-cards-151's illustration-rare.css
 * (css.ts has the conversions and the approximations every port shares). It
 * needs no mask: the reference confines it with a clip-path, the border
 * polygon, which select.ts's clip region stands in for: the illustration
 * rare's frame less its stage tab, the notch the polygon cuts, and an
 * evolution's picture and band, which the reference's per-card masks leave
 * out too (regions.ts's `sv-illustration`).
 *
 * Approximations:
 * - The shine's :after soft-lights onto the shine's own background inside
 *   the shine's isolated group, and only the group reaches the card, through
 *   the shine's filter and color-dodge. The DSL has no groups, so the :after
 *   is folded into the shine as one last soft-light layer: its bands, with
 *   its dark radial (at its middle stop) and its own filter baked into their
 *   stops. Its sunpillar hue and its grain are dropped.
 * - The glare's clip-path, the same border polygon, is the effect's own
 *   region (`withinRegion`), as the shine's is: so it too spares the stage
 *   tab, and, where the polygon does not, an evolution's picture and band.
 */

const ANGLE = 133; // --angle
const BANDS = [
  stop(hex('#0e152e'), 0),
  stop(hsl(180, 10, 60), 3.8),
  stop(hsl(180, 29, 66), 4.5),
  stop(hsl(180, 10, 60), 5.2),
  stop(hex('#0e152e'), 10),
  stop(hex('#0e152e'), 12),
];

// The :after, as the fold above describes it. Its bands sit on its dark radial
// as the shine's do; hard-light over black at the radial's middle 15% is
// hard-light over a 0.425 grey (see the shine's first layer below).
const AFTER_FILTER = { brightness: 1, contrast: 2.5, saturate: 1.75 };
const AFTER_BACKDROP = grey(0.5 * (1 - 0.15));
const afterBands = mapStops(
  repeatingLinear(ANGLE, BANDS, {
    size: [1.95, 1],
    position: [times(BACKGROUND_X, -1), times(BACKGROUND_Y, -1)],
  }),
  (c) => filterRGB(blendRGB('hard-light', AFTER_BACKDROP, c), AFTER_FILTER),
);

export const illustrationRare: Effect = {
  id: 'illustration-rare',
  shine: [
    {
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
        {
          ...repeatingLinear(ANGLE, BANDS, { size: [3, 1], position: AT_BACKGROUND }),
          blend: 'hard-light',
        },
        {
          ...repeatingLinear(0, sunpillarStops(sunpillarClr(1)), {
            size: [2, 7],
            position: [fixed(0), BACKGROUND_Y],
          }),
          blend: 'hue',
        },
        // --imgsize: 500px by 100%
        {
          ...texture('grain', { size: [pxWide(500), 1], position: [CENTER, CENTER] }),
          blend: 'screen',
        },
        // the folded :after, whose own mix-blend-mode is soft-light
        { ...afterBands, blend: 'soft-light' },
      ],
      // The `:not(.masked)` rule, which outranks the base rule's brightness(.8)
      // contrast(2.95) saturate(.65) on a card with no mask, as every card is here.
      filter: { brightness: { base: 0.7 }, contrast: { base: 2 }, saturate: { base: 0.5 } },
      mixBlend: 'color-dodge',
    },
  ],
  // Neither glare has a z-index in illustration-rare.css, so both paint
  // beneath the shine (base.css's z-index: 3), in markup order.
  beneath: [
    {
      layers: [{ ...radial([stop(WHITE, 0), stop(BLACK, 100)]), blend: 'normal' }],
      filter: { brightness: { base: 0.9 }, contrast: { base: 1.2 } },
      mixBlend: 'overlay',
      // clip-path: var(--clip), the border polygon: the shine's region
      withinRegion: true,
    },
    {
      layers: [{ ...radial([stop(WHITE, 5), stop(BLACK, 120)]), blend: 'normal' }],
      filter: { brightness: { base: 0.475 }, contrast: { base: 2 } },
      mixBlend: 'screen',
      opacity: { base: 0, fromCenter: 1 },
    },
  ],
  glare: [],
};
