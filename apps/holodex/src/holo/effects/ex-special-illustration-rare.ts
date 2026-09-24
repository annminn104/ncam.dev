import type { Effect } from '../shader/types';
import {
  BACKGROUND_Y,
  BLACK,
  CENTER,
  COVER,
  SUNPILLAR,
  affineLayers,
  filtered,
  halfTile,
  hex,
  hsl,
  linear,
  pxTall,
  pxWide,
  radial,
  repeatingLinear,
  stop,
  texture,
  times,
  type CssBox,
} from './css';

/**
 * Special Illustration Rare, ported from pokemon-cards-151's
 * ex-special-illustration-rare.css (css.ts has the conversions and the
 * approximations every port shares). The reference confines its glitter to
 * the card's own foil mask; that is dropped, and select.ts's clip region
 * stands in. hyper-rare.css is this file with one number changed, and
 * hyper-rare.ts ports it on its own.
 *
 * Approximations:
 * - The shine has no background of its own. Its :before, the holo, lies over
 *   nothing inside the shine's isolated group, so its `overlay` changes
 *   nothing; its :after, two light bands, hard-lights onto it; the group
 *   color-dodges onto the card. That group is one exact stack here: the bands
 *   first, their own contrast(.75) spelt as two layers, then the holo
 *   *overlaid* onto them, since overlay(b, s) is hard-light(s, b). What is
 *   lost is the bands' tilt: their angle, ±0.25 of the card's rotation, is
 *   fixed at the card at rest.
 * - The glitter is a group too: --iri9, with --iri8 (:before) and --iri7
 *   (:after) overlaid onto it, cross-fading on --pointer-from-top. One `iri`
 *   texture stands in for all three: the parent's moved half a tile, and one
 *   child layer for both children. Their own brightness(2) contrast(1.2)
 *   cannot apply to one layer, so iri is screened over itself (x -> 2x - x^2),
 *   which matches them on iri's ground and comes within a quarter on its
 *   brightest dots. Their saturate(2), and their 3px of parallax, are dropped.
 * - glare2 is white through the card's foil (a luminance mask), overlaid. With
 *   iri for the foil, that is 0.5 grey (overlay's neutral) where iri is
 *   black, rising toward the 0.9 its contrast(.8) makes of white where iri is
 *   white. It follows iri's channels rather than its luminance, which for a
 *   speckle this grey is nearly the same.
 */

/** black 24%, #797979 30%, black 36%: one light band */
const BAND = [stop(BLACK, 24), stop(hex('#797979'), 30), stop(BLACK, 36)];

/**
 * var(--holo), three times over, 5% apart. The copies meet on a repeated
 * --sunpillar-1, so every 35% runs 1 to 6 and back to 1, then holds 1 for 5%:
 * one period of seven DSL stops, the seventh wrapping flat onto the first.
 */
const HOLO = [...SUNPILLAR, SUNPILLAR[0], SUNPILLAR[0]].map((color, i) => stop(color, 5 * i));

/** --glitter-size: 150px 150px, at center */
const GLITTER: CssBox = { size: [pxWide(150), pxTall(150)], position: [CENTER, CENTER] };
const child = texture('iri', GLITTER);

export const exSpecialIllustrationRare: Effect = {
  id: 'ex-special-illustration-rare',
  shine: [
    // .card__glitter, beneath the shine
    {
      layers: [
        { ...child, blend: 'normal' },
        { ...child, blend: 'screen' },
        // --iri9 with the children overlaid onto it: overlay(b, s) is hard-light(s, b)
        { ...halfTile(child), blend: 'hard-light' },
      ],
      filter: { brightness: { base: 1 }, contrast: { base: 2 }, saturate: { base: 1.2 } },
      mixBlend: 'plus-lighter',
      opacity: { base: 0.2, fromCenter: 0.5 },
    },
    // .card__shine and its :before and :after, one isolated group
    {
      layers: [
        // :after's background-image bottom first: the band at `50%
        // calc(var(--background-y) * -1.3)`, which reaches the card from the
        // tile above its own
        {
          ...linear(0, BAND, {
            size: [3, 3],
            position: [CENTER, times(BACKGROUND_Y, -1.3)],
            tile: [0, -1],
          }),
          blend: 'normal',
        },
        // and the band at `50% calc(var(--background-y) * 1.7)`, above it by
        // background-blend-mode: exclusion
        {
          ...linear(0, BAND, { size: [3, 3], position: [CENTER, times(BACKGROUND_Y, 1.7)] }),
          blend: 'exclusion',
        },
        // :after's contrast(.75)
        ...affineLayers(0.75, 0.125),
        // :before's holo, its contrast(.75) baked into its stops, overlaid onto
        // the :after: the :after hard-lit onto it, as the reference blends them
        {
          ...filtered(repeatingLinear(15, HOLO, { size: [2.4, 2.4], position: [CENTER, CENTER] }), {
            contrast: 0.75,
          }),
          blend: 'overlay',
        },
      ],
      filter: { brightness: { base: 0.6 }, contrast: { base: 1.5 }, saturate: { base: 1 } },
      mixBlend: 'color-dodge',
    },
  ],
  glare: [
    {
      layers: [{ ...radial([stop(hsl(0, 0, 80), 10), stop(hsl(0, 0, 50), 70)]), blend: 'normal' }],
      filter: { contrast: { base: 1.5 } },
      mixBlend: 'multiply',
    },
    {
      // background: white, masked by --foil's luminance, after contrast(.8)
      layers: [{ ...texture('iri', COVER), blend: 'normal' }, ...affineLayers(0.4, 0.5)],
      mixBlend: 'overlay',
    },
  ],
};
