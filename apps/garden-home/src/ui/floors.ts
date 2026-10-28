import type { CutMode } from '../scene/cutaway';

/** One of the floor buttons on the site route (ui/FloorSelector): the cut it picks, its label and its tooltip. */
export interface FloorButton {
  mode: CutMode;
  label: string;
  title: string;
}

/**
 * The floor buttons, top to bottom (AGENTS.md, Controls): the cut by the camera's distance, as before; the whole house
 * with its roof; the upper floor; the ground floor; the basement (art/README.md, Basement), which only a button
 * shows.
 */
export const FLOOR_BUTTONS: readonly FloorButton[] = [
  { mode: 'auto', label: 'Auto', title: "Cut the house by the camera's distance" },
  { mode: 'none', label: 'Roof', title: 'The whole house, roof on' },
  { mode: 'upper', label: 'Upper floor', title: 'The upper floor, roof off' },
  { mode: 'ground', label: 'Ground floor', title: 'The ground floor, upper floor off' },
  { mode: 'basement', label: 'Basement', title: 'The basement, the whole house off' },
];

/** Whether the button of `mode` shows pressed while `current` is picked. */
export function isPressed(mode: CutMode, current: CutMode): boolean {
  return mode === current;
}
