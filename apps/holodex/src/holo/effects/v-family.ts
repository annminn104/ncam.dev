import type { BlendMode } from '../shader/blend';
import type { Element, Filter, Layer } from '../shader/types';
import {
  BACKGROUND_X,
  BACKGROUND_Y,
  BLACK,
  exactRadial,
  exactRepeatingLinear,
  fixed,
  hex,
  hsl,
  plus,
  stop,
  sunpillarClr,
  times,
  type Background,
  type CssStop,
} from './css';

/**
 * The shine pokemon-cards-css gives its V family — v-full-art.css, and
 * shiny-rare.css, shiny-v.css, v-star.css and v-regular.css after it, and the
 * supporter full art trainer-full-art.css dresses — built once: a foil image
 * over sunpillar bands over dark bands with a pale core over a faint dark
 * radial, the `:after` the same four again at other sizes and running the
 * other way, the whole group colour-dodged (base.css). Each rarity picks the
 * foil, the blends and the filters; the rest is common to them all.
 */

/** v-full-art.css's --space (--angle is 133deg). */
const SPACE = 5;

/**
 * `repeating-linear-gradient(var(--angle), #0e152e 0%, hsl(180, 10%, 60%) 3.8%,
 * hsl(180, 29%, 66%) 4.5%, hsl(180, 10%, 60%) 5.2%, #0e152e 10%, #0e152e 12%)`
 */
export const V_BANDS: CssStop[] = [
  stop(hex('#0e152e'), 0),
  stop(hsl(180, 10, 60), 3.8),
  stop(hsl(180, 29, 66), 4.5),
  stop(hsl(180, 10, 60), 5.2),
  stop(hex('#0e152e'), 10),
  stop(hex('#0e152e'), 12),
];

/** `radial-gradient(farthest-corner circle at var(--pointer-x) var(--pointer-y), …)`, faint black. */
export const V_DARK: CssStop[] = [
  stop(BLACK, 12, 0.1),
  stop(BLACK, 20, 0.15),
  stop(BLACK, 120, 0.25),
];

/**
 * `repeating-linear-gradient(0deg, var(--sunpillar-clr-1) calc(var(--space)*1),
 * … var(--sunpillar-clr-1) calc(var(--space)*7))` on an element whose
 * --sunpillar-clr-1 is --sunpillar-`first` (base.css: 1 on the shine, 6 on its
 * `:after`).
 */
export function sunStops(first: 1 | 5 | 6, space = SPACE): CssStop[] {
  const clr = sunpillarClr(first);
  return [...clr, clr[0]].map((color, i) => stop(color, space * (i + 1)));
}

export interface VShine {
  /** the rarity's --foil, as a layer with its box, for both the shine and its `:after` */
  foil: Background;
  /** background-blend-mode: the foil's, the sunpillars', the bands' */
  blends: [BlendMode, BlendMode, BlendMode];
  /** the shine's filter */
  filter: Filter;
  /** the `:after`'s filter and mix-blend-mode */
  after: { filter: Filter; mixBlend: BlendMode };
  /**
   * How far the bands follow --background-y across as well as down:
   * v-full-art.css's `calc(var(--background-x) + (var(--background-y) * 0.2))`
   * is 0.2; v-star.css and v-regular.css's plain --background-x is 0.
   */
  slant: number;
  /** a `:before` with a positive z-index, painted after the `:after`, where the rarity draws one */
  before?: Element;
}

/** The four layers, bottom first: the dark radial, the bands, the sunpillars, the foil. */
function layers(v: VShine, which: 'shine' | 'after'): Layer[] {
  const bandsX = plus(BACKGROUND_X, times(BACKGROUND_Y, v.slant));
  const [foilBlend, sunBlend, bandsBlend] = v.blends;
  const after = which === 'after';
  return [
    {
      ...exactRadial(V_DARK, { size: [2, 1], position: [BACKGROUND_X, BACKGROUND_Y] }),
      blend: 'normal',
    },
    {
      ...exactRepeatingLinear(133, V_BANDS, {
        size: after ? [1.95, 1] : [3, 1],
        position: after ? [times(bandsX, -1), times(BACKGROUND_Y, -1)] : [bandsX, BACKGROUND_Y],
      }),
      blend: bandsBlend,
    },
    {
      ...exactRepeatingLinear(0, sunStops(after ? 6 : 1), {
        size: after ? [2, 4] : [2, 7],
        position: [fixed(0), BACKGROUND_Y],
      }),
      blend: sunBlend,
    },
    { ...v.foil, blend: foilBlend },
  ];
}

/** The V family's shine element: its layers, its `:after`, and its `:before` above that. */
export function vShine(v: VShine): Element {
  return {
    layers: layers(v, 'shine'),
    children: [
      { layers: layers(v, 'after'), filter: v.after.filter, mixBlend: v.after.mixBlend },
      ...(v.before ? [v.before] : []),
    ],
    filter: v.filter,
    mixBlend: 'color-dodge',
  };
}
