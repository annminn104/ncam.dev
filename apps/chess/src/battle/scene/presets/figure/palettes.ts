import type { Side } from '../../../../game/coords';
import type { PresetId } from '../../../../presets-meta';
import { DARK_COURT_PALETTE } from '../dark-court/palette';
import { HOLY_ORDER_PALETTE } from '../holy-order/palette';

/** Every figure preset's colours by side, one per palette slot (slots.ts). */
export const FIGURE_PALETTES = {
  'holy-order': HOLY_ORDER_PALETTE,
  'dark-court': DARK_COURT_PALETTE,
} satisfies Partial<Record<PresetId, Record<Side, readonly string[]>>>;

export type FigurePresetId = keyof typeof FIGURE_PALETTES;

/** A figure set's trim metal: which of material.ts's METAL_RAMPS its `trim` slot takes. */
export type Metal = 'gold' | 'silver';

/** Each figure preset's trim metal by side. */
export const FIGURE_METALS: Record<FigurePresetId, Record<Side, Metal>> = {
  'holy-order': { w: 'gold', b: 'gold' },
  'dark-court': { w: 'silver', b: 'gold' },
};

export function isFigurePreset(id: PresetId): id is FigurePresetId {
  return id in FIGURE_PALETTES;
}
