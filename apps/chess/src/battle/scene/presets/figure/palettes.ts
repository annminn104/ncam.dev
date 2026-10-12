import type { Side } from '../../../../game/coords';
import type { PresetId } from '../../../../presets-meta';
import { HOLY_ORDER_PALETTE } from '../holy-order/palette';

/** Every figure preset's colours by side, one per palette slot (slots.ts). */
export const FIGURE_PALETTES = {
  'holy-order': HOLY_ORDER_PALETTE,
} satisfies Partial<Record<PresetId, Record<Side, readonly string[]>>>;

export type FigurePresetId = keyof typeof FIGURE_PALETTES;

export function isFigurePreset(id: PresetId): id is FigurePresetId {
  return id in FIGURE_PALETTES;
}
