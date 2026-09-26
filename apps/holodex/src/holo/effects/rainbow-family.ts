import type { PointerDriven } from '../shader/types';
import { hsl, stop, texture, type Background, type CssStop, type RGB } from './css';

/**
 * What pokemon-cards-css's rainbow family shares — rainbow-holo.css,
 * rainbow-alt.css, shiny-vmax.css and swsh-pikachu's rule — and its glitter:
 * the muted --r-clr-1..7 the family sets on its shine, and the glitter sheet
 * at --glittersize.
 */

/** --r-clr-1..7. */
export const RCLR: RGB[] = [
  hsl(0, 57, 37),
  hsl(40, 53, 39),
  hsl(90, 60, 35),
  hsl(180, 60, 35),
  hsl(180, 60, 35),
  hsl(210, 57, 39),
  hsl(280, 55, 31),
];

/**
 * `linear-gradient(<angle>, var(--r-clr-1), … var(--r-clr-7), var(--r-clr-1),
 * … three times over, var(--r-clr-1))`: 22 stops, spread evenly.
 */
export const RCLR_STOPS: CssStop[] = [...RCLR, ...RCLR, ...RCLR, RCLR[0]].map((color, i) =>
  stop(color, (100 * i) / 21),
);

/** --glittersize: 25% of the card each way. */
export const GLITTERSIZE = 0.25;

/** `var(--glitter)` at --glittersize, placed at `position`. */
export function glitter(position: [PointerDriven, PointerDriven]): Background {
  return texture('glitter', { size: [GLITTERSIZE, GLITTERSIZE], position });
}
