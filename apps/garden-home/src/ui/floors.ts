import type { CutMode } from '../scene/cutaway';

/** One of the floor buttons on the site route (ui/FloorSelector): the cut it picks, its label and its tooltip. */
export interface FloorButton {
  mode: CutMode;
  label: string;
  title: string;
}

/**
 * The floor buttons, top to bottom (interaction spec §2): the cut by the camera's distance, as before; the whole house
 * with its roof; the upper floor; the ground floor; the basement (villa v2 spec §12 "Tầng hầm"), which only a button
 * shows.
 */
export const FLOOR_BUTTONS: readonly FloorButton[] = [
  { mode: 'auto', label: 'Tự động', title: 'Cắt nhà theo khoảng cách camera' },
  { mode: 'none', label: 'Mái', title: 'Xem cả ngôi nhà, có mái' },
  { mode: 'upper', label: 'Tầng 2', title: 'Xem tầng 2 (bỏ mái)' },
  { mode: 'ground', label: 'Tầng 1', title: 'Xem tầng 1 (bỏ tầng 2)' },
  { mode: 'basement', label: 'Hầm', title: 'Xem tầng hầm (bỏ cả ngôi nhà)' },
];

/** Whether the button of `mode` shows pressed while `current` is picked. */
export function isPressed(mode: CutMode, current: CutMode): boolean {
  return mode === current;
}
