import type { Effect, PointerDriven } from '../shader/types';
import { TEXTURE_SIZE } from '../textures';
import {
  CENTER,
  COVER,
  POINTER_X,
  POINTER_Y,
  autoHeight,
  exactLinear,
  fixed,
  fixedFilter,
  grey,
  nudged,
  plus,
  pxTall,
  pxWide,
  radial,
  stop,
  texture,
  times,
} from './css';
import { glareNeutral } from './legacy-glare';
import { GLITTERSIZE, RCLR, RCLR_STOPS, glitter } from './rainbow-family';

/** swsh-pikachu.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 0.9, contrast: 2 };

/** `calc(25% + (var(--pointer-x) / 2))` and the like: half as far as the pointer. */
const HALFWAY: [PointerDriven, PointerDriven] = [
  plus(fixed(0.25), times(POINTER_X, 0.5)),
  plus(fixed(0.25), times(POINTER_Y, 0.5)),
];

/** The glitter's position, nudged by secret-rare.css's --shift (1px), `+` or `-` it. */
const SHIFTED = (sign: 1 | -1): [PointerDriven, PointerDriven] => [
  nudged(POINTER_X, pxWide(1), GLITTERSIZE, sign),
  nudged(POINTER_Y, pxTall(1), GLITTERSIZE, sign),
];

/**
 * Crown Zenith's Pikachu, ported from pokemon-cards-css's rule for
 * swsh12pt5 160 on its unmasked path: rainbow-holo's shine, but its glitter
 * nudged a pixel against the pointer (secret-rare.css's --shift), its
 * illusion-mask `:before` multiplied, and its `:after` excluded with its own
 * glitter nudged the other way. The glare is ported too, beneath the shine
 * (legacy-glare.ts).
 *
 * Approximation: glitter and illusion-mask are drawn here (textures.ts), not
 * the reference's images; --shift's 1px is at CARD_PX.
 */
export const swshPikachu: Effect = {
  id: 'swsh-pikachu',
  shine: [
    {
      layers: [
        { ...exactLinear(-30, RCLR_STOPS, { size: [4, 4], position: HALFWAY }), blend: 'normal' },
        { ...glitter(SHIFTED(1)), blend: 'soft-light' },
        {
          ...exactLinear(-45, [stop(RCLR[0], 0), stop(RCLR[4], 100)], {
            size: [2, 2],
            position: HALFWAY,
          }),
          blend: 'luminosity',
        },
      ],
      children: [
        {
          // :before
          layers: [
            {
              ...texture('illusion-mask', {
                size: autoHeight(0.33, TEXTURE_SIZE['illusion-mask']),
                position: [CENTER, CENTER],
              }),
              blend: 'normal',
            },
          ],
          filter: fixedFilter({ brightness: 2.5, contrast: 1 }),
          mixBlend: 'multiply',
          // calc((var(--pointer-from-center) + 0.4) * 0.6)
          opacity: { base: 0.24, fromCenter: 0.6 },
        },
        {
          // :after
          layers: [
            {
              ...exactLinear(-60, RCLR_STOPS, { size: [4, 4], position: [POINTER_X, POINTER_Y] }),
              blend: 'normal',
            },
            { ...glitter(SHIFTED(-1)), blend: 'soft-light' },
          ],
          filter: {
            brightness: { base: 0.35, fromCenter: 0.35 },
            contrast: fixed(2),
            saturate: fixed(1),
          },
          mixBlend: 'exclusion',
        },
      ],
      filter: {
        brightness: { base: 0.75, fromCenter: 0.5 },
        contrast: fixed(2),
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
            [stop(grey(0.8), 0), stop(grey(0.749), 30, 0.25), stop(grey(0.216), 130)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--pointer-from-center) * .9)
      opacity: { base: 0, fromCenter: 0.9 },
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
