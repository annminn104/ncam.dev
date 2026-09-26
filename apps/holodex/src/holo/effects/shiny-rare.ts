import type { Effect } from '../shader/types';
import { TEXTURE_SIZE } from '../textures';
import {
  BLACK,
  CENTER,
  COVER,
  WHITE,
  autoHeight,
  exactRadial,
  fixed,
  fixedFilter,
  hsl,
  radial,
  stop,
  texture,
} from './css';
import { glareNeutral } from './legacy-glare';
import { vShine } from './v-family';

/** shiny-rare.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1.2, contrast: 1, saturate: 0.7 };

/**
 * A shiny rare, ported from pokemon-cards-css's shiny-rare.css on its unmasked
 * path: the V family's shine (v-family.ts) with illusion, its `:after`
 * differenced, and, above that by z-index, a `:before` of white about the
 * pointer, overlaid at three quarters, the group in the card's own region (the
 * art window, or its stage cut). The glare is ported from shiny-rare.css,
 * multiplied, beneath the shine (legacy-glare.ts), and only as strong as the
 * pointer is far from the middle.
 *
 * Approximation: illusion is drawn here (textures.ts), not the reference's
 * image.
 */
export const shinyRare: Effect = {
  id: 'shiny-rare',
  shine: [
    vShine({
      foil: texture('illusion', {
        size: autoHeight(0.33, TEXTURE_SIZE.illusion),
        position: [CENTER, CENTER],
      }),
      blends: ['exclusion', 'hue', 'hard-light'],
      filter: {
        brightness: { base: 0.35, fromCenter: 0.3 },
        contrast: fixed(2),
        saturate: fixed(1.5),
      },
      after: {
        filter: {
          brightness: { base: 0.5, fromCenter: 0.4 },
          contrast: fixed(1.4),
          saturate: fixed(1.2),
        },
        mixBlend: 'difference',
      },
      slant: 0.2,
      before: {
        // :before, z-index 1
        layers: [{ ...exactRadial([stop(WHITE, 0), stop(BLACK, 40, 0)]), blend: 'normal' }],
        mixBlend: 'overlay',
        opacity: fixed(0.75),
      },
    }),
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(WHITE, 0), stop(hsl(320, 5, 15), 150)],
            COVER,
            glareNeutral('multiply', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--card-opacity) * var(--pointer-from-center))
      opacity: { base: 0, fromCenter: 1 },
      mixBlend: 'multiply',
    },
  ],
  glare: [],
};
