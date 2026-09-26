import type { Effect, PointerDriven } from '../shader/types';
import {
  BACKGROUND_Y,
  CENTER,
  COVER,
  POINTER_X,
  POINTER_Y,
  WHITE,
  exactRadial,
  exactRepeatingLinear,
  fixed,
  grey,
  hsl,
  plus,
  radial,
  stop,
  times,
} from './css';
import { glareNeutral } from './legacy-glare';

/** --space: 5%, each band's step. */
const SPACE = 5;

/** The gallery's pastel bands, 75% opaque, one --space apart. */
const BANDS = [
  hsl(283, 49, 60),
  hsl(2, 74, 59),
  hsl(53, 67, 53),
  hsl(93, 56, 52),
  hsl(176, 38, 50),
  hsl(228, 100, 77),
  hsl(283, 49, 61),
].map((color, i) => stop(color, SPACE * (i + 1), 0.75));

/** `at calc((var(--pointer-x) * 0.5) + 25%) …`: the ellipse follows the pointer half as far. */
const HALFWAY: [PointerDriven, PointerDriven] = [
  plus(fixed(0.25), times(POINTER_X, 0.5)),
  plus(fixed(0.25), times(POINTER_Y, 0.5)),
];

/**
 * A trainer gallery holo, ported from pokemon-cards-css's
 * trainer-gallery-holo.css (css.ts has the conversions): pastel bands at −22°,
 * three-quarters opaque, sliding down the card with the pointer, and an
 * `:after` ellipse of white to deep violet hard-lit onto them, the group
 * colour-dodged inside the card's borders; its `:before` is switched off. The
 * glare is ported too, soft-lit with no filter, beneath the shine
 * (legacy-glare.ts). trainer-gallery-v-regular and trainer-gallery-v-max
 * spread this effect but paint glares of their own. The reference clips the
 * shine to the borders (--clip-borders) and masks it with the card's own
 * mask besides; select.ts's clip region stands in for both on a Pokémon: the
 * border rect less the weakness bar, and a Basic's tab or an evolution's
 * picture and band, which its masks leave out (regions.ts's
 * `swsh-gallery-holo`).
 */
export const trainerGalleryHolo: Effect = {
  id: 'trainer-gallery-holo',
  shine: [
    {
      layers: [
        {
          ...exactRepeatingLinear(-22, BANDS, { size: [3, 4], position: [fixed(0), BACKGROUND_Y] }),
          blend: 'normal',
        },
      ],
      children: [
        {
          // :after
          layers: [
            {
              ...exactRadial(
                [stop(WHITE, 5), stop(hsl(300, 100, 11), 40, 0.6), stop(grey(0.22), 120)],
                { size: [4, 5], position: [CENTER, CENTER] },
                { at: HALFWAY, ellipse: true },
              ),
              blend: 'normal',
            },
          ],
          filter: {
            brightness: { base: 0.4, fromCenter: 0.2 },
            contrast: fixed(0.85),
            saturate: fixed(1.1),
          },
          mixBlend: 'hard-light',
        },
      ],
      filter: {
        brightness: { base: 0.5, fromCenter: 0.3 },
        contrast: fixed(2.3),
        saturate: fixed(1),
      },
      mixBlend: 'color-dodge',
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(WHITE, 10), stop(WHITE, 35, 0.6), stop(hsl(180, 11, 35), 60)],
            COVER,
            glareNeutral('soft-light'),
          ),
          blend: 'normal',
        },
      ],
      mixBlend: 'soft-light',
    },
  ],
  glare: [],
};
