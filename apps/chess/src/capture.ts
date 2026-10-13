import { ARENAS, type ArenaId } from './arenas-meta';
import { DEFAULT_PRESET, isPresetId, type PresetId } from './presets-meta';

// Capture mode (scripts/capture-arenas.mjs, scripts/capture-presets.mjs), read from the standalone
// page's query only: the federated mount never sees it. ?capture=<arena> alone is the arena's
// lobby preview; preset, lineup, view and quality add the piece-set previews and the review.

export const REVIEW_VIEWS = ['home', 'close', 'far', 'orbit'] as const;
export type ReviewView = (typeof REVIEW_VIEWS)[number];

/**
 * Each side's six types, smallest to largest from the left: white on rank 2 and black on rank 7,
 * far enough apart that the back row shows over the front one.
 */
export const LINEUP_FEN = '8/1pnrbqk1/8/8/8/8/1PNRBQK1/8 w - - 0 1';

export interface CaptureOptions {
  arena: ArenaId;
  /** Both sides play this set, ready for the lobby or not. */
  preset: PresetId;
  /** The lineup position, every figure facing the camera, instead of the opening. */
  lineup: boolean;
  /** A review camera; without one, the arena's preview view (or the lineup's). */
  view: ReviewView | null;
  /** The quality the battle starts at, and keeps: capture mode never declines. */
  quality: 'high' | 'low';
}

export function parseCapture(search: string): CaptureOptions | null {
  const query = new URLSearchParams(search);
  const arena = ARENAS.find((a) => a.id === query.get('capture'))?.id;
  if (!arena) return null;
  const preset = query.get('preset');
  const view = REVIEW_VIEWS.find((v) => v === query.get('view')) ?? null;
  return {
    arena,
    preset: isPresetId(preset) ? preset : DEFAULT_PRESET,
    lineup: query.has('lineup'),
    view,
    quality: query.get('quality') === 'low' ? 'low' : 'high',
  };
}
