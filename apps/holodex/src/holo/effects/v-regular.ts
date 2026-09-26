import type { Effect } from '../shader/types';
import { CENTER, COVER, WHITE, fixedFilter, grey, hsl, pxWide, radial, stop, texture } from './css';
import { glareNeutral } from './legacy-glare';
import { vShine } from './v-family';

/** v-regular.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 0.9, contrast: 1.75 };

/**
 * A V, ported from pokemon-cards-css's v-regular.css on its unmasked path: the
 * V family's shine (v-family.ts) with grain, 500px wide and the card tall,
 * screened onto the sunpillars, which are hue-blended onto the bands, hard-lit
 * onto a faint dark radial; its `:after` the same again, soft-lit. Unclipped,
 * as the CSS leaves it. The glare is ported from v-regular.css, hard-lit at
 * half strength, beneath the shine (legacy-glare.ts).
 *
 * Approximations: grain is drawn here (textures.ts), not the reference's
 * image; its 500px is at CARD_PX.
 */
export const vRegular: Effect = {
  id: 'v-regular',
  shine: [
    vShine({
      foil: texture('grain', { size: [pxWide(500), 1], position: [CENTER, CENTER] }),
      blends: ['screen', 'hue', 'hard-light'],
      filter: fixedFilter({ brightness: 0.7, contrast: 2, saturate: 0.5 }),
      after: {
        filter: fixedFilter({ brightness: 1, contrast: 2.5, saturate: 1.75 }),
        mixBlend: 'soft-light',
      },
      slant: 0,
    }),
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(WHITE, 0), stop(hsl(210, 3, 54), 45, 0.33), stop(grey(0.2), 130, 0.9)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      opacity: { base: 0.5 },
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
