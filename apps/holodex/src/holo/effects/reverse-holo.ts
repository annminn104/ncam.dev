import type { Effect } from '../shader/types';
import {
  BLACK,
  CENTER,
  COVER,
  POINTER_X,
  POINTER_Y,
  WHITE,
  exactLinear,
  exactRadial,
  filterRGB,
  fixed,
  fixedFilter,
  radial,
  stop,
  type CssStop,
} from './css';
import { glareNeutral, overStops } from './legacy-glare';

/** reverse-holo.css's .card__glare filter, and its :after's own. */
const GLARE_FILTER = { brightness: 0.7, contrast: 1.5 };
const AFTER_FILTER = { brightness: 1, contrast: 1.5 };

/** The glare's own radial. */
const GLARE: CssStop[] = [stop(WHITE, 10, 0.8), stop(WHITE, 20, 0.5), stop(BLACK, 90, 0.75)];

/** Its :after's, through the :after's own filter. */
const AFTER: CssStop[] = [stop(WHITE, 10), stop(WHITE, 20, 0.5), stop(BLACK, 120, 0.5)].map(
  (s) => ({ ...s, color: filterRGB(s.color, AFTER_FILTER) }),
);

/** Every 2.5% out to the :after's last stop, where source-over has to be sampled. */
const SAMPLED = Array.from({ length: 49 }, (_, i) => i * 2.5);

/**
 * Reverse holo, ported from pokemon-cards-css's reverse-holo.css on its
 * unmasked path (css.ts has the conversions), where --foil is `none`: a black
 * and white radial about the pointer soft-lit onto a diagonal linear that
 * slides with it, colour-dodged over the card outside its art (the inverted
 * region, select.ts), through a brightness the card's type sets
 * (--foil-brightness, the shader's uFoilBrightness), fading as the pointer
 * leaves the middle. The glare is ported too, beneath the shine
 * (legacy-glare.ts): its :after is painted with no blend over the glare's own
 * radial, and both are radials about the pointer in one box, so the pair is
 * one gradient: CSS's source-over of the one onto the other, sampled.
 *
 * Approximation: the reference clips the glare's :after to the card's text and
 * border on stage and trainer cards (--clip-stage-invert,
 * --clip-trainer-invert); here it covers the card.
 */
export const reverseHolo: Effect = {
  id: 'reverse-holo',
  shine: [
    {
      layers: [
        // below it lies --foil, `none` here: the linear's difference meets nothing
        {
          ...exactLinear(-45, [stop(BLACK, 15), stop(WHITE, 50), stop(BLACK, 85)], {
            size: [2, 2],
            position: [POINTER_X, POINTER_Y],
          }),
          blend: 'normal',
        },
        {
          ...exactRadial([stop(WHITE, 5), stop(BLACK, 50), stop(WHITE, 80)], {
            size: [1.2, 1.2],
            position: [CENTER, CENTER],
          }),
          blend: 'soft-light',
        },
      ],
      filter: {
        brightness: { base: 0, fromFoilBrightness: 1 },
        contrast: fixed(1.5),
        saturate: fixed(1),
      },
      mixBlend: 'color-dodge',
      // calc((1.5 * var(--card-opacity)) - var(--pointer-from-center))
      opacity: { base: 1.5, fromCenter: -1 },
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(overStops(AFTER, GLARE, SAMPLED), COVER, glareNeutral('overlay', GLARE_FILTER)),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
