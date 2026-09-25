import type { Effect } from '../shader/types';
import { BLACK, COVER, filterRGB, fixedFilter, grey, hsl, radial, stop, type RGB } from './css';
import { glareNeutral } from './legacy-glare';
import { SUNPILLAR } from './palette';

/** shiny-vmax.css's filter, the same for its .card__glare and its :after. */
const GLARE_FILTER = { brightness: 1, contrast: 1.25 };
const afterStop = (c: RGB, at: number, alpha: number) =>
  stop(filterRGB(c, GLARE_FILTER), at, alpha);

/**
 * A shiny VMAX. The shine is derived by eye from pokemon-cards-css; the glare
 * is ported from shiny-vmax.css, beneath the shine (legacy-glare.ts): its
 * radial, overlaid from base.css, and an :after radial overlaid onto it. The
 * reference masks that :after with the card's own foil mask where it has one;
 * with none, as here, it covers the card.
 */
export const shinyVmax: Effect = {
  id: 'shiny-vmax',
  shine: [
    {
      layers: [
        { source: { kind: 'glitter', scale: 7 }, blend: 'normal' },
        {
          source: { kind: 'repeating-linear', angleDeg: 115, space: 0.045, stops: SUNPILLAR },
          blend: 'hue',
          size: [4, 4],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.3 },
        contrast: { base: 1.8 },
        saturate: { base: 1.4 },
      },
      mixBlend: 'lighten',
      opacity: { base: 0.45, fromCenter: 0.4 },
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
