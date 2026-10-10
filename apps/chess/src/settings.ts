import { ARENAS, type ArenaId } from './arenas-meta';
import { levelOf, type LevelId } from './engine/levels';
import { DEFAULT_PRESET, isPresetId, presetMeta, type PresetId } from './presets-meta';

export type Mode = 'hotseat' | 'ai';
export type SidePick = 'w' | 'b' | 'random';

export interface GameSettings {
  mode: Mode;
  playerSide: SidePick;
  level: LevelId;
  arenaId: ArenaId;
  /** Hot-seat: turn the camera to whoever moves next. */
  autoRotate: boolean;
  /** Piece sets. Linked: one choice for both sides (vs AI the AI answers with its contrast). */
  whitePreset: PresetId;
  blackPreset: PresetId;
  linkPresets: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'ai',
  playerSide: 'w',
  level: 2,
  arenaId: 'cloud-peak',
  autoRotate: true,
  whitePreset: DEFAULT_PRESET,
  blackPreset: DEFAULT_PRESET,
  linkPresets: true,
};

/** A stored preset id, if it is still one the lobby offers. */
function presetOr(v: unknown): PresetId {
  return isPresetId(v) && presetMeta(v).ready ? v : DEFAULT_PRESET;
}

const KEY = 'ncam-chess:settings';

export function parseSettings(raw: unknown): GameSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const r = raw as Record<string, unknown>;
  return {
    mode: r.mode === 'hotseat' || r.mode === 'ai' ? r.mode : DEFAULT_SETTINGS.mode,
    playerSide:
      r.playerSide === 'w' || r.playerSide === 'b' || r.playerSide === 'random'
        ? r.playerSide
        : DEFAULT_SETTINGS.playerSide,
    level: typeof r.level === 'number' ? levelOf(r.level).id : DEFAULT_SETTINGS.level,
    arenaId: ARENAS.some((a) => a.id === r.arenaId)
      ? (r.arenaId as ArenaId)
      : DEFAULT_SETTINGS.arenaId,
    autoRotate: typeof r.autoRotate === 'boolean' ? r.autoRotate : DEFAULT_SETTINGS.autoRotate,
    whitePreset: presetOr(r.whitePreset),
    blackPreset: presetOr(r.blackPreset),
    linkPresets: typeof r.linkPresets === 'boolean' ? r.linkPresets : DEFAULT_SETTINGS.linkPresets,
  };
}

export function loadSettings(): GameSettings {
  try {
    const text = localStorage.getItem(KEY);
    return parseSettings(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode / blocked storage: settings just aren't remembered.
  }
}
