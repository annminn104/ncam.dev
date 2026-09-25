import type { Effect } from '../shader/types';
import {
  CENTER,
  COVER,
  exactRadial,
  fixed,
  fixedFilter,
  grey,
  hsl,
  radial,
  stop,
  texture,
} from './css';
import { glareNeutral } from './legacy-glare';
import { vShine } from './v-family';

/** v-star.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 0.55, contrast: 2 };

/**
 * A VSTAR, ported from pokemon-cards-css's v-star.css on its unmasked path:
 * the V family's shine (v-family.ts) with ancient, the unmasked --foil, 18% ×
 * 15% of the card, excluded onto the sunpillars, which are hue-blended onto
 * the bands, hard-lit onto a faint dark radial; its `:after` the same again,
 * excluded; and, above them by z-index, a `:before` radial of pale lilac about
 * the pointer, hard-lit at .8. The glare is ported from v-star.css, hard-lit,
 * beneath the shine (legacy-glare.ts), only as strong as the pointer is far
 * from the middle.
 *
 * Approximation: ancient is drawn here (textures.ts), not the reference's
 * image.
 */
export const vStar: Effect = {
  id: 'v-star',
  shine: [
    vShine({
      foil: texture('ancient', { size: [0.18, 0.15], position: [CENTER, CENTER] }),
      blends: ['exclusion', 'hue', 'hard-light'],
      filter: {
        brightness: { base: 0.35, fromCenter: 0.25 },
        contrast: fixed(1.8),
        saturate: fixed(1.75),
      },
      after: {
        filter: {
          brightness: { base: 0.5, fromCenter: 0.75 },
          contrast: fixed(1.5),
          saturate: fixed(1.5),
        },
        mixBlend: 'exclusion',
      },
      slant: 0,
      before: {
        // :before, z-index 2
        layers: [
          {
            ...exactRadial([
              stop(hsl(190, 7, 80), 0, 0.75),
              stop(hsl(260, 7, 50), 45, 0.25),
              stop(hsl(310, 7, 50), 120),
            ]),
            blend: 'normal',
          },
        ],
        mixBlend: 'hard-light',
        opacity: fixed(0.8),
      },
    }),
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(hsl(195, 90, 90), 5), stop(hsl(300, 3, 60), 60), stop(grey(0.15), 150)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--card-opacity) * (var(--pointer-from-center) * .75))
      opacity: { base: 0, fromCenter: 0.75 },
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
