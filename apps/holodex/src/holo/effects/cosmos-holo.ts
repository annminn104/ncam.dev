import type { Effect, PointerDriven } from '../shader/types';
import { TEXTURE_SIZE } from '../textures';
import {
  BLACK,
  COVER,
  POINTER_X,
  POINTER_Y,
  coverSize,
  exactRadial,
  exactRepeatingLinear,
  filterRGB,
  fixed,
  fixedFilter,
  grey,
  hsl,
  plus,
  radial,
  stop,
  texture,
  times,
  type CssBox,
} from './css';
import { glareNeutral } from './legacy-glare';

/** cosmos-holo.css's .card__glare filter, and its :after's own. */
const GLARE_FILTER = { brightness: 0.75, contrast: 2, saturate: 2 };
const AFTER_FILTER = { brightness: 0.75, contrast: 2.5, saturate: 2 };

/** --space: 4%, each colour's step. */
const SPACE = 4;

/** The rainbow at 82°, there and back, one --space a colour. */
const RAINBOW = [
  hsl(53, 65, 60),
  hsl(93, 56, 50),
  hsl(176, 54, 49),
  hsl(228, 59, 55),
  hsl(283, 60, 55),
  hsl(326, 59, 51),
  hsl(326, 59, 51),
  hsl(283, 60, 55),
  hsl(228, 59, 55),
  hsl(176, 54, 49),
  hsl(93, 56, 50),
  hsl(53, 65, 60),
].map((color, i) => stop(color, SPACE * (i + 1)));

/**
 * The rainbow's image, 400% × 900% of the card, placed at
 * `calc(<inset> + (var(--pointer-from-left) * <span>))`: each layer's rainbow
 * crosses its span of the image as the pointer crosses the card.
 */
const rainbowBox = (inset: number): CssBox => {
  const along = (p: PointerDriven): PointerDriven => plus(fixed(inset), times(p, 1 - 2 * inset));
  return { size: [4, 9], position: [along(POINTER_X), along(POINTER_Y)] };
};

/** A cosmos layer, `cover` at --cosmosbg's 0 0 (its seed is 0 here). */
const cosmos = (kind: 'cosmos-bottom' | 'cosmos-middle' | 'cosmos-top') =>
  texture(kind, { size: coverSize(TEXTURE_SIZE[kind]), position: [fixed(0), fixed(0)] });

/** The pseudo-elements' filter: brightness(1.25) contrast(1.75) saturate(.8). */
const LAYER_FILTER = fixedFilter({ brightness: 1.25, contrast: 1.75, saturate: 0.8 });

/**
 * Cosmos foil, ported from pokemon-cards-css's cosmos-holo.css: the
 * starfield's bottom layer colour-burnt onto a rainbow multiplied onto a
 * pastel radial, colour-dodged inside the card's own region; then, above it by
 * z-index, its middle layer lightened onto the rainbow, overlaid, and its top
 * layer multiplied onto it, multiplied, each layer's rainbow running at a
 * speed of its own. The glare is ported too, beneath the shine
 * (legacy-glare.ts): its radial, overlaid, and an :after radial soft-lit onto
 * it, which fades from opaque at the top of the card to a quarter at the
 * bottom.
 *
 * Approximations: the three cosmos layers are drawn here (textures.ts), not
 * the reference's images; --cosmosbg's random offset is 0. The reference
 * clips the glare's :after to the art window on stage and supporter cards;
 * here it covers the card. And it soft-lights that :after onto the glare's
 * radial only where the radial is opaque, where here it meets the radial with
 * its transparency already folded: measured alone on the same art, this glare
 * sits 3 to 6 luminance points further from the reference than the other
 * ported glares do (AGENTS.md).
 */
export const cosmosHolo: Effect = {
  id: 'cosmos-holo',
  shine: [
    {
      layers: [
        {
          ...exactRadial([
            stop(hsl(180, 100, 89), 5, 0.5),
            stop(hsl(180, 14, 57), 40, 0.3),
            stop(BLACK, 130),
          ]),
          blend: 'normal',
        },
        { ...exactRepeatingLinear(82, RAINBOW, rainbowBox(0.1)), blend: 'multiply' },
        { ...cosmos('cosmos-bottom'), blend: 'color-burn' },
      ],
      children: [
        {
          // :before, z-index 2
          layers: [
            { ...exactRepeatingLinear(82, RAINBOW, rainbowBox(0.15)), blend: 'normal' },
            { ...cosmos('cosmos-middle'), blend: 'lighten' },
          ],
          filter: LAYER_FILTER,
          mixBlend: 'overlay',
        },
        {
          // :after, z-index 3
          layers: [
            { ...exactRepeatingLinear(82, RAINBOW, rainbowBox(0.2)), blend: 'normal' },
            { ...cosmos('cosmos-top'), blend: 'multiply' },
          ],
          filter: LAYER_FILTER,
          mixBlend: 'multiply',
        },
      ],
      filter: fixedFilter({ brightness: 1, contrast: 1, saturate: 0.8 }),
      mixBlend: 'color-dodge',
    },
  ],
  beneath: [
    {
      layers: [
        {
          ...radial(
            [stop(hsl(204, 100, 95), 5, 0.8), stop(hsl(250, 15, 20), 150)],
            COVER,
            glareNeutral('overlay', GLARE_FILTER),
          ),
          blend: 'normal',
        },
        {
          // the :after, soft-lit onto it: calc(1 - var(--pointer-from-top) * .75)
          ...radial([
            stop(filterRGB(hsl(280, 100, 96), AFTER_FILTER), 5),
            stop(filterRGB(grey(0.1), AFTER_FILTER), 60),
          ]),
          blend: 'soft-light',
          opacity: { base: 1, fromTop: -0.75 },
        },
      ],
      filter: fixedFilter(GLARE_FILTER),
      // calc(var(--card-opacity) * (0.25 + var(--pointer-from-center)))
      opacity: { base: 0.25, fromCenter: 1 },
      mixBlend: 'overlay',
    },
  ],
  glare: [],
};
