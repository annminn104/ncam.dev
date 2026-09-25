import type { Effect } from '../shader/types';
import { CENTER, fixedFilter, grey, hsl, radial, stop } from './css';
import { glareNeutral } from './legacy-glare';
import { SUNPILLAR } from './palette';

/** v-full-art.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1, contrast: 1.2, saturate: 1 };

/**
 * A full art V. The shine is derived by eye from pokemon-cards-css; the glare
 * is ported from v-full-art.css (one rule for Pokémon and supporters alike),
 * hard-lit, beneath the shine (legacy-glare.ts): a radial in an image 120% ×
 * 150% of the card, centred on it.
 */
export const vFullArt: Effect = {
  id: 'v-full-art',
  shine: [
    {
      layers: [
        {
          source: { kind: 'repeating-linear', angleDeg: 133, space: 0.05, stops: SUNPILLAR },
          blend: 'normal',
          size: [3, 3],
          offset: { x: { base: 0, fromLeft: 1 }, y: { base: 0, fromTop: 1 } },
        },
        { source: { kind: 'glitter', scale: 6 }, blend: 'overlay' },
      ],
      filter: {
        brightness: { base: 0.55, fromCenter: 0.3 },
        contrast: { base: 2 },
        saturate: { base: 1.2 },
      },
      mixBlend: 'exclusion',
      opacity: { base: 0.45, fromCenter: 0.4 },
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(grey(0.75), 5), stop(hsl(200, 5, 35), 60), stop(hsl(320, 40, 10), 150)],
            { size: [1.2, 1.5], position: [CENTER, CENTER] },
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      opacity: { base: 0.75 },
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
