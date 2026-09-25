import type { Effect, PointerDriven } from '../shader/types';
import {
  BACKGROUND_X,
  BACKGROUND_Y,
  BLACK,
  COVER,
  WHITE,
  exactRadial,
  exactRepeatingLinear,
  fixed,
  fixedFilter,
  grey,
  hsl,
  plus,
  radial,
  stop,
  times,
} from './css';
import { glareNeutral } from './legacy-glare';
import { glitter } from './rainbow-family';
import { sunStops } from './v-family';

/** `calc(50% + (50% - (var(--background-x))) * 3)`: three times as far as --background, the other way. */
const against = (p: PointerDriven): PointerDriven => plus(fixed(2), times(p, -3));

/**
 * An amazing rare, ported from pokemon-cards-css's amazing-rare.css on its
 * unmasked path: two glitters, colour-burnt and soft-lit, over a radial that
 * runs from dark green through a clear pale teal to near-white; a `:before`
 * radial lightened at half strength (its --foil is `none` here); and an
 * `:after` of the sunpillars in saturation, fading as the pointer leaves the
 * middle; the group colour-dodged inside the art window, which the unmasked
 * rule sets on every card. The glare is ported too, beneath the shine
 * (legacy-glare.ts).
 *
 * Approximation: glitter is drawn here (textures.ts), not the reference's
 * image.
 */
export const amazingRare: Effect = {
  id: 'amazing-rare',
  shine: [
    {
      layers: [
        {
          ...exactRadial([
            stop(hsl(150, 20, 10), 10),
            stop(hsl(177, 22, 80), 50, 0.1),
            stop(grey(0.95), 90, 0.98),
          ]),
          blend: 'normal',
        },
        { ...glitter([fixed(0.55), fixed(0.55)]), blend: 'color-burn' },
        { ...glitter([fixed(0.4), fixed(0.45)]), blend: 'soft-light' },
      ],
      children: [
        {
          // :before, its --foil none
          layers: [
            {
              ...exactRadial([
                stop(hsl(50, 20, 90), 10, 0.95),
                stop([181 / 255, 139 / 255, 164 / 255], 50, 0.5),
                stop(BLACK, 60),
              ]),
              blend: 'normal',
            },
          ],
          filter: fixedFilter({ brightness: 1, contrast: 1, saturate: 1 }),
          mixBlend: 'lighten',
          opacity: fixed(0.5),
        },
        {
          // :after
          layers: [
            {
              ...exactRepeatingLinear(133, sunStops(6), {
                size: [4, 8],
                position: [against(BACKGROUND_X), against(BACKGROUND_Y)],
              }),
              blend: 'normal',
            },
          ],
          filter: {
            brightness: { base: 0.75, fromCenter: -0.5 },
            contrast: fixed(1),
            saturate: fixed(1),
          },
          mixBlend: 'saturation',
        },
      ],
      filter: fixedFilter({ brightness: 1, contrast: 1, saturate: 0.9 }),
      mixBlend: 'color-dodge',
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(WHITE, 10), stop(WHITE, 20, 0.85), stop(BLACK, 90, 0.35)],
            COVER,
            glareNeutral('multiply'),
          ),
          blend: 'normal',
        },
      ],
      mixBlend: 'multiply',
    },
  ],
  glare: [],
};
