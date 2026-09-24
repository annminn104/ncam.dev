import type { Effect, Element, Filter, PointerDriven } from '../shader/types';
import {
  BACKGROUND_X,
  BACKGROUND_Y,
  CENTER,
  COVER,
  DARK_RADIAL,
  AT_BACKGROUND,
  composeFilters,
  fixed,
  grey,
  hex,
  hsl,
  plus,
  radial,
  repeatingLinear,
  stop,
  sunpillarClr,
  sunpillarStops,
  texture,
  times,
  type CssBox,
} from './css';

/**
 * Ultra Rare in the Scarlet & Violet era, the full-art ex, ported from
 * pokemon-cards-151's ex-full-art.css (css.ts has the conversions and the
 * approximations every port shares). The reference draws a per-card mask as
 * the top layer of its stack and confines the foil with it; the mask layer is
 * dropped, and select.ts's clip region stands in.
 *
 * Approximations:
 * - --foil, the card's own foil texture, is the `iri` speckle.
 * - The :after `exclusion`s onto the shine's own background inside the
 *   shine's isolated group, and only the group reaches the card, through the
 *   shine's filter and color-dodge. The DSL has no groups, so the :after is an
 *   element that color-dodges onto the card through its own filter and then
 *   the shine's, composed into one; its pointer-driven brightness makes that
 *   exact only where --pointer-from-center is 0 or 1. Both stacks are mostly
 *   dark with bright bands, which an exclusion unites much as two dodges do;
 *   where two bands cross, the exclusion would have dimmed them.
 * - The reference's `:not(.masked)` rules are not used. They are built around
 *   one texture, illusion.png, in a `hue` blend; with iri standing in, that
 *   blend would paint the whole stack iri's one violet hue. This port keeps
 *   the rules the demo's masked cards render with, less their mask.
 * - The rarity's full-art Supporters have a glare of their own in the
 *   reference; the Pokemon's is used for all.
 */

const ANGLE = 128.5; // --angle
const BANDS = [
  stop(hex('#0e152e'), 0),
  stop(hsl(180, 10, 60), 3.8),
  stop(hsl(180, 29, 66), 4.5),
  stop(hsl(180, 10, 60), 5.2),
  stop(hex('#0e152e'), 14),
  stop(hex('#0e152e'), 16),
];
/** calc(var(--background-x) + (var(--background-y) * 0.2)) */
const BANDS_X: PointerDriven = plus(BACKGROUND_X, times(BACKGROUND_Y, 0.2));
/** brightness(calc((var(--pointer-from-center) * 0.4) + .5)), both elements' */
const BRIGHTNESS: PointerDriven = { base: 0.5, fromCenter: 0.4 };
const SHINE_FILTER: Filter = {
  brightness: BRIGHTNESS,
  contrast: fixed(2.5),
  saturate: fixed(0.66),
};

interface Layout {
  clr: 1 | 6;
  sunpillar: CssBox;
  bands: CssBox;
  filter: Filter;
}

/** The shine and its :after share one rule for their layers and blends; the :after moves and resizes them. */
function element(layout: Layout): Element {
  return {
    // background-image bottom first, less the --mask on top. background-blend-mode
    // `soft-light, soft-light, hue, hard-light` lists the mask, the foil, the
    // sunpillar and the bands top first.
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
      // --foil, at --imgsize: cover
      { ...texture('iri', COVER), blend: 'soft-light' },
    ],
    filter: layout.filter,
    mixBlend: 'color-dodge',
  };
}

export const exFullArt: Effect = {
  id: 'ex-full-art',
  shine: [
    element({
      clr: 1,
      sunpillar: { size: [2, 7], position: [fixed(0), BACKGROUND_Y] },
      bands: { size: [3, 1], position: [BANDS_X, BACKGROUND_Y] },
      filter: SHINE_FILTER,
    }),
    // :after. The Pokemon ex has no :before.
    element({
      clr: 6,
      sunpillar: { size: [2, 4], position: [fixed(0), BACKGROUND_Y] },
      bands: { size: [1.95, 1], position: [times(BANDS_X, -1), times(BACKGROUND_Y, -1)] },
      filter: composeFilters(
        { brightness: BRIGHTNESS, contrast: fixed(1.66), saturate: fixed(1) },
        SHINE_FILTER,
      ),
    }),
  ],
  glare: [
    {
      layers: [
        {
          ...radial(
            [stop(hsl(0, 0, 75), 5), stop(hsl(200, 5, 35), 70), stop(hsl(320, 40, 10), 150)],
            { size: [1.2, 1.5], position: [CENTER, CENTER] },
          ),
          blend: 'normal',
        },
      ],
      filter: { brightness: { base: 0.8 }, contrast: { base: 1 }, saturate: { base: 1 } },
      mixBlend: 'hard-light',
    },
  ],
};
