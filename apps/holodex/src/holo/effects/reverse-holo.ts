import type { Effect } from '../shader/types';
import { BLACK, COVER, WHITE, filterRGB, fixedFilter, radial, stop, type CssStop } from './css';
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
 * Reverse holo: glitter over the card body, art window left clean.
 *
 * The shine is derived by eye from pokemon-cards-css; the glare is ported from
 * reverse-holo.css, beneath the shine (legacy-glare.ts). Its :after is painted
 * with no blend over the glare's own radial, and both are radials about the
 * pointer in one box, so the pair is one gradient: CSS's source-over of the
 * one onto the other, sampled. Approximation: the reference clips the :after
 * to the card's text and border on stage and trainer cards
 * (--clip-stage-invert, --clip-trainer-invert); here it covers the card.
 */
export const reverseHolo: Effect = {
  id: 'reverse-holo',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 6 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 110,
            space: 0.05,
            stops: [
              [0.78, 0.18, 0.21],
              [0.93, 0.87, 0.06],
              [0.13, 0.91, 0.52],
              [0.05, 0.74, 0.91],
              [0.79, 0.16, 0.95],
            ],
          },
          blend: 'soft-light',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 0.6 }, y: { base: 0, fromTop: 0.6 } },
        },
      ],
      filter: {
        brightness: { base: 0.55, fromCenter: 0.3 },
        contrast: { base: 1.6 },
        saturate: { base: 1.2 },
      },
      mixBlend: 'color-dodge',
      opacity: { base: 0.4, fromCenter: 0.4 },
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
