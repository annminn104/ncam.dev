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
  hsl,
  plus,
  radial,
  stop,
  texture,
  times,
} from './css';
import { glareNeutral } from './legacy-glare';
import { RCLR, RCLR_STOPS, glitter } from './rainbow-family';

/** rainbow-holo.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 0.9, contrast: 1.75 };

/** `calc(25% + (var(--pointer-x) / 2))` and the like: half as far as the pointer. */
const HALFWAY: [PointerDriven, PointerDriven] = [
  plus(fixed(0.25), times(POINTER_X, 0.5)),
  plus(fixed(0.25), times(POINTER_Y, 0.5)),
];

/** The unmasked --foil, illusion-mask, at --imgsize 33%. */
const ILLUSION_MASK = texture('illusion-mask', {
  size: autoHeight(0.33, TEXTURE_SIZE['illusion-mask']),
  position: [CENTER, CENTER],
});

/**
 * A rainbow rare, ported from pokemon-cards-css's rainbow-holo.css on its
 * unmasked path: a muted linear rainbow at −45° in luminosity over glitter
 * soft-lit onto the rainbow at −30°, both following the pointer half as far;
 * a `:before` of illusion-mask, the unmasked --foil, darkening, strongest as
 * the pointer leaves the middle; and an `:after` of glitter soft-lit onto the
 * rainbow at −60°, colour-dodged. The glare is ported too, beneath the shine
 * (legacy-glare.ts).
 *
 * Approximation: glitter and illusion-mask are drawn here (textures.ts), not
 * the reference's images.
 */
export const rainbowHolo: Effect = {
  id: 'rainbow-holo',
  shine: [
    {
      layers: [
        { ...exactLinear(-30, RCLR_STOPS, { size: [4, 4], position: HALFWAY }), blend: 'normal' },
        { ...glitter([CENTER, CENTER]), blend: 'soft-light' },
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
          layers: [{ ...ILLUSION_MASK, blend: 'normal' }],
          filter: fixedFilter({ brightness: 2.5, contrast: 1 }),
          mixBlend: 'darken',
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
            { ...glitter([CENTER, CENTER]), blend: 'soft-light' },
          ],
          filter: {
            brightness: { base: 0.55, fromCenter: 0.3 },
            contrast: fixed(2),
            saturate: fixed(1),
          },
          mixBlend: 'color-dodge',
        },
      ],
      filter: {
        brightness: { base: 0.6, fromCenter: 0.25 },
        contrast: fixed(2.2),
        saturate: fixed(0.75),
      },
      mixBlend: 'color-dodge',
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(grey(0.8), 0), stop(hsl(187, 10, 85), 30, 0.25), stop(hsl(197, 6, 25), 120)],
            COVER,
            glareNeutral('hard-light', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--pointer-from-center) * 0.9)
      opacity: { base: 0, fromCenter: 0.9 },
      mixBlend: 'hard-light',
    },
  ],
  glare: [],
};
