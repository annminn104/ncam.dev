import type { Effect } from '../shader/types';
import { TEXTURE_SIZE } from '../textures';
import { CENTER, autoHeight, fixed, fixedFilter, grey, hsl, radial, stop, texture } from './css';
import { glareNeutral } from './legacy-glare';
import { vShine } from './v-family';

/** v-full-art.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 1, contrast: 1.2, saturate: 1 };

/**
 * A full art V, ported from pokemon-cards-css's v-full-art.css on its
 * unmasked path: the V family's shine (v-family.ts) with illusion, the
 * unmasked --foil, excluded onto the sunpillars, which are hue-blended onto
 * the bands, hard-lit onto a faint dark radial; its `:after` the same again,
 * excluded; its `:before` switched off. The glare is ported from v-full-art.css
 * (one rule for Pokémon and supporters alike), hard-lit, beneath the shine
 * (legacy-glare.ts): a radial in an image 120% × 150% of the card, centred on
 * it. trainer-gallery-v-regular draws this shine too, by the same rule.
 *
 * Approximation: illusion is drawn here (textures.ts), not the reference's
 * image.
 */
export const vFullArt: Effect = {
  id: 'v-full-art',
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
          brightness: { base: 0.8, fromCenter: 0.5 },
          contrast: fixed(1.6),
          saturate: fixed(1.4),
        },
        mixBlend: 'exclusion',
      },
      slant: 0.2,
    }),
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
