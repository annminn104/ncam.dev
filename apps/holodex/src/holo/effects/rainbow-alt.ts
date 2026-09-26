import type { Effect, Element } from '../shader/types';
import {
  BACKGROUND_X,
  BACKGROUND_Y,
  BLACK,
  CENTER,
  COVER,
  exactLinear,
  exactRepeatingLinear,
  fixed,
  fixedFilter,
  hsl,
  radial,
  stop,
  times,
} from './css';
import { glareNeutral } from './legacy-glare';
import { RCLR_STOPS, glitter } from './rainbow-family';

/** rainbow-alt.css's .card__glare filter. */
const GLARE_FILTER = { brightness: 0.9, contrast: 2 };

/** The pastel bands, 75% opaque, one --space apart. */
const bands = (space: number) =>
  [
    hsl(283, 49, 60),
    hsl(2, 70, 58),
    hsl(53, 67, 53),
    hsl(93, 56, 52),
    hsl(176, 38, 50),
    hsl(228, 100, 77),
    hsl(283, 49, 61),
  ].map((color, i) => stop(color, space * (i + 1), 0.75));

/** rainbow-alt.css's shine at a --space (5%; v-max.css sets 6% on a gallery VMAX). */
export function rainbowAltShine(space: number): Element[] {
  return [
    {
      layers: [
        {
          ...exactLinear(-30, RCLR_STOPS, {
            size: [4, 4],
            position: [times(BACKGROUND_X, 1.5), times(BACKGROUND_Y, 1.5)],
          }),
          blend: 'normal',
        },
        { ...glitter([CENTER, CENTER]), blend: 'overlay' },
        {
          ...exactRepeatingLinear(133, bands(space), {
            size: [2, 4],
            position: [fixed(0), BACKGROUND_Y],
          }),
          blend: 'luminosity',
        },
      ],
      children: [
        {
          // :after (its :before's --foil is none: nothing to draw)
          layers: [
            {
              ...exactLinear(-60, RCLR_STOPS, {
                size: [4, 4],
                position: [times(BACKGROUND_X, -1.5), times(BACKGROUND_Y, -1.5)],
              }),
              blend: 'normal',
            },
            { ...glitter([CENTER, CENTER]), blend: 'overlay' },
          ],
          filter: {
            brightness: { base: 0.6, fromCenter: 0.5 },
            contrast: fixed(3),
            saturate: fixed(1),
          },
          mixBlend: 'color-dodge',
          // calc(1.2 + (var(--pointer-from-center) / 2) * -1)
          opacity: { base: 1.2, fromCenter: -0.5 },
        },
      ],
      filter: {
        brightness: { base: 0.3, fromCenter: 0.3 },
        contrast: fixed(3),
        saturate: fixed(1.8),
      },
      mixBlend: 'color-dodge',
    },
  ];
}

/**
 * A rainbow rare's alternate, ported from pokemon-cards-css's rainbow-alt.css
 * on its unmasked path: pastel bands at 133°, three-quarters opaque, in
 * luminosity over glitter overlaid onto a muted rainbow at −30° that runs half
 * as far again as --background; its `:before` draws nothing (--foil is
 * `none`); its `:after` glitter overlaid onto the rainbow at −60°, running the
 * other way, colour-dodged, fading as the pointer leaves the middle. The glare
 * is ported too, beneath the shine (legacy-glare.ts). A gallery VMAX draws
 * this shine too, by the same rule, at v-max.css's --space.
 *
 * Approximation: glitter is drawn here (textures.ts), not the reference's
 * image.
 */
export const rainbowAlt: Effect = {
  id: 'rainbow-alt',
  shine: rainbowAltShine(5),
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(hsl(50, 20, 90), 0, 0.75), stop(hsl(150, 20, 30), 45, 0.65), stop(BLACK, 100)],
            COVER,
            glareNeutral('overlay', GLARE_FILTER),
          ),
          blend: 'normal',
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      opacity: { base: 0.75 },
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
