import type { Effect, Filter } from '../shader/types';
import { TEXTURE_SIZE } from '../textures';
import {
  BLACK,
  CENTER,
  WHITE,
  autoHeight,
  exactRadial,
  fixed,
  fixedFilter,
  radial,
  stop,
  texture,
} from './css';
import { BASE_GLARE, glareNeutral } from './legacy-glare';
import { vShine } from './v-family';

/** trainer-full-art.css's .card__glare filter, for a supporter. */
const GLARE_FILTER = { brightness: 1.5, contrast: 1.4, saturate: 1 };

/** Its unmasked shine and :after filter: brightness(calc((pfc * 0.05) + .6)) contrast(1.5) saturate(1.2). */
const FILTER: Filter = {
  brightness: { base: 0.6, fromCenter: 0.05 },
  contrast: fixed(1.5),
  saturate: fixed(1.2),
};

/**
 * A full art trainer, ported from pokemon-cards-css's supporter full art:
 * v-full-art.css's V family shine (v-family.ts) under trainer-full-art.css's
 * unmasked rules, whose --foil is trainerbg at 20% of the card, colour-burnt
 * onto the sunpillars, which are hue-blended onto the bands, hard-lit onto a
 * faint dark radial; the `:after` the same, excluded; and, above them by
 * z-index, a `:before` of white about the pointer, screened at half strength.
 * The glare is ported from trainer-full-art.css, which styles a supporter's:
 * base.css's radial drawn 170% of the card from its top left corner (it sets a
 * size and no position), multiplied, beneath the shine (legacy-glare.ts).
 * The reference confines the shine with the card's own mask, never a
 * clip-path; select.ts's clip region stands in: the whole card less the
 * TRAINER header and the rule box its masks leave out (regions.ts's
 * `swsh-ultra`), or the rule box alone on a Galarian Gallery card
 * (`swsh-galarian-trainer`).
 *
 * Approximation: trainerbg is drawn here (textures.ts), not the reference's
 * image.
 */
export const trainerFullArt: Effect = {
  id: 'trainer-full-art',
  shine: [
    vShine({
      foil: texture('trainerbg', {
        size: autoHeight(0.2, TEXTURE_SIZE.trainerbg),
        position: [CENTER, CENTER],
      }),
      blends: ['color-burn', 'hue', 'hard-light'],
      filter: FILTER,
      after: { filter: FILTER, mixBlend: 'exclusion' },
      slant: 0.2,
      before: {
        // :before, z-index 1
        layers: [{ ...exactRadial([stop(WHITE, 0), stop(BLACK, 80, 0)]), blend: 'normal' }],
        mixBlend: 'screen',
        opacity: fixed(0.5),
      },
    }),
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            BASE_GLARE,
            { size: [1.7, 1.7], position: [fixed(0), fixed(0)] },
            glareNeutral('multiply', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      opacity: { base: 0.75 },
      mixBlend: 'multiply',
    },
  ],
  glare: [],
};
