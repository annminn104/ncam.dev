import type { Effect } from '../shader/types';
import { COVER, filterRGB, fixedFilter, grey, hsl, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';

/** cosmos-holo.css's .card__glare filter, and its :after's own. */
const GLARE_FILTER = { brightness: 0.75, contrast: 2, saturate: 2 };
const AFTER_FILTER = { brightness: 0.75, contrast: 2.5, saturate: 2 };

/**
 * Cosmos foil: galaxy speckle under spectral bands, three parallaxed layers.
 *
 * The shine is derived by eye from pokemon-cards-css; the glare is ported from
 * cosmos-holo.css, beneath the shine (legacy-glare.ts): its radial, overlaid,
 * and an :after radial soft-lit onto it, which fades from opaque at the top of
 * the card to a quarter at the bottom. Approximations: the reference clips
 * the :after to the art window on stage and supporter cards; here it covers
 * the card. And the reference soft-lights the :after onto the glare's radial
 * only where that radial is opaque, where here it meets the radial with its
 * transparency already folded (a DSL layer has no alpha): measured alone on
 * the same art, this glare sits 3 to 6 luminance points further from the
 * reference than the other ported glares do (AGENTS.md).
 */
export const cosmosHolo: Effect = {
  id: 'cosmos-holo',
  shine: [
    {
      layers: [
        { source: { kind: 'grain', scale: 1 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 82,
            space: 0.04,
            stops: [
              [0.86, 0.79, 0.35],
              [0.55, 0.82, 0.33],
              [0.33, 0.78, 0.86],
              [0.62, 0.38, 0.87],
            ],
          },
          blend: 'multiply',
          size: [4, 9],
          offset: { x: { base: 0.1, fromLeft: 0.8 }, y: { base: 0.1, fromTop: 0.8 } },
        },
      ],
      filter: { brightness: { base: 1 }, contrast: { base: 1 }, saturate: { base: 0.8 } },
      mixBlend: 'color-dodge',
      opacity: { base: 0.5, fromCenter: 0.3 },
    },
    {
      layers: [
        { source: { kind: 'glitter', scale: 3 }, blend: 'normal' },
        {
          source: {
            kind: 'repeating-linear',
            angleDeg: 82,
            space: 0.04,
            stops: [
              [0.86, 0.79, 0.35],
              [0.33, 0.78, 0.86],
            ],
          },
          blend: 'lighten',
          size: [4, 9],
          offset: { x: { base: 0.15, fromLeft: 0.7 }, y: { base: 0.15, fromTop: 0.7 } },
        },
      ],
      filter: { brightness: { base: 1.25 }, contrast: { base: 1.75 }, saturate: { base: 0.8 } },
      mixBlend: 'overlay',
      opacity: { base: 0.6, fromCenter: 0.3 },
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(hsl(204, 100, 95), 5, 0.8), stop(hsl(250, 15, 20), 150)],
            COVER,
            glareNeutral('overlay', GLARE_FILTER),
          ),
          blend: 'normal',
        },
        {
          // the :after, soft-lit onto it: calc(1 - var(--pointer-from-top) * .75)
          ...radial([
            stop(filterRGB(hsl(280, 100, 96), AFTER_FILTER), 5),
            stop(filterRGB(grey(0.1), AFTER_FILTER), 60),
          ]),
          blend: 'soft-light',
          opacity: { base: 1, fromTop: -0.75 },
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--card-opacity) * (0.25 + var(--pointer-from-center)))
      opacity: { base: 0.25, fromCenter: 1 },
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
