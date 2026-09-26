import type { Effect } from '../shader/types';
import { TEXTURE_SIZE } from '../textures';
import { CENTER, autoHeight, fixed, fixedFilter, grey, hsl, radial, stop, texture } from './css';
import { glareNeutral } from './legacy-glare';
import { vShine } from './v-family';

/** shiny-v.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 0.88, contrast: 2.25, saturate: 0.7 };

/**
 * A shiny V, ported from pokemon-cards-css's shiny-v.css on its unmasked path:
 * the V family's shine (v-family.ts) as v-full-art draws it, with illusion,
 * but its `:after` differenced under shiny-rare.css's `.card.card[data-rarity*=
 * "rare shiny"]` rule, which outranks shiny-v.css's own; its `:before`
 * switched off. The glare is ported from shiny-v.css, darkening, beneath the
 * shine (legacy-glare.ts): a radial in an image 120% × 140% of the card,
 * centred on it, and only as strong as the pointer is far from the middle.
 *
 * Approximation: illusion is drawn here (textures.ts), not the reference's
 * image.
 */
export const shinyV: Effect = {
  id: 'shiny-v',
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
    }),
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(grey(0.9), 5), stop(hsl(200, 5, 45), 80), stop(hsl(320, 40, 10), 150)],
            { size: [1.2, 1.4], position: [CENTER, CENTER] },
            glareNeutral('darken', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--card-opacity) * var(--pointer-from-center) * 0.75)
      opacity: { base: 0, fromCenter: 0.75 },
      mixBlend: 'darken',
    },
  ],
  glare: [],
};
