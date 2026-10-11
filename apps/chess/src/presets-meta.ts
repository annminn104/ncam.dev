import type { PieceSymbol } from 'chess.js';
import type { Side } from './game/coords';
import { TREASURES } from './game/treasures';
import { assetUrl } from './lib/asset-url';

// What each piece set is called and how it looks in swatches — pure data, safe for the server
// render and the lobby. The battle's renderers live in src/battle/scene/presets/.

export type PresetId =
  'treasures' | 'holy-order' | 'dark-court' | 'gentlemen' | 'bunny-mages' | 'constellation';
export type PresetKind = 'treasure' | 'figure' | 'chibi' | 'constellation';
export type Swatch = readonly [main: string, accent: string, glow: string];

export interface PresetMeta {
  id: PresetId;
  name: string;
  tagline: string;
  kind: PresetKind;
  /** Shown in the lobby. A batch flips its presets to true once their renderer lands. */
  ready: boolean;
  contrast: PresetId;
  swatches: Record<Side, Swatch>;
  pieces: Record<PieceSymbol, string>;
}

export const DEFAULT_PRESET: PresetId = 'treasures';

export const PRESETS: readonly PresetMeta[] = [
  {
    id: 'treasures',
    name: 'Cultivation Treasures',
    kind: 'treasure',
    ready: true,
    tagline: 'Floating seals, flying swords and spirit bells of the nine heavens.',
    contrast: 'constellation',
    swatches: { w: ['#eef6ef', '#d8b45a', '#5ef2ff'], b: ['#15181d', '#8a5a35', '#ff3355'] },
    pieces: {
      k: TREASURES.k.name,
      q: TREASURES.q.name,
      r: TREASURES.r.name,
      b: TREASURES.b.name,
      n: TREASURES.n.name,
      p: TREASURES.p.name,
    },
  },
  {
    id: 'holy-order',
    name: 'Holy Order',
    kind: 'figure',
    ready: false,
    tagline: 'Mitred patriarchs, haloed abbesses and templar wardens.',
    contrast: 'dark-court',
    swatches: { w: ['#f4f6fb', '#d6b25e', '#7fb8e6'], b: ['#1c1d24', '#c9a24e', '#c8283c'] },
    pieces: {
      k: 'Patriarch',
      q: 'Saint Abbess',
      r: 'Templar Warden',
      b: 'Bishop',
      n: 'Paladin',
      p: 'Acolyte',
    },
  },
  {
    id: 'dark-court',
    name: 'Dark Overlord Court',
    kind: 'chibi',
    ready: false,
    tagline: 'An undead sovereign, his fallen queen and the battle maids of the tomb.',
    contrast: 'holy-order',
    swatches: { w: ['#e9e4d6', '#b9c0cc', '#a77bff'], b: ['#121016', '#b3122e', '#d4a64a'] },
    pieces: {
      k: 'Undead Overlord',
      q: 'Fallen Queen',
      r: 'Death Knight',
      b: 'Necromancer',
      n: 'Bone Rider',
      p: 'Battle Maid',
    },
  },
  {
    id: 'gentlemen',
    name: 'Gentleman Phantoms',
    kind: 'chibi',
    ready: false,
    tagline: 'Top hats, tailcoats and a parasol at midnight.',
    contrast: 'bunny-mages',
    swatches: { w: ['#f5f3ee', '#d9b24a', '#2f7fe0'], b: ['#141417', '#d0342c', '#f0a23a'] },
    pieces: {
      k: 'Count',
      q: 'Lady Phantom',
      r: 'Guard Butler',
      b: 'Magician',
      n: 'Cavalier',
      p: 'Page',
    },
  },
  {
    id: 'bunny-mages',
    name: 'Gothic Bunny Mages',
    kind: 'chibi',
    ready: false,
    tagline: 'Ribbons, ruffles and staffs topped with moon-eared bunnies.',
    contrast: 'gentlemen',
    swatches: { w: ['#d9cdf2', '#ffffff', '#f2a7c8'], b: ['#16151a', '#3a3a44', '#d8b45a'] },
    pieces: {
      k: 'Bunny Archmage',
      q: 'Bunny Empress',
      r: 'Tower Witch',
      b: 'Priestess',
      n: 'Rabbit Rider',
      p: 'Bunny Apprentice',
    },
  },
  {
    id: 'constellation',
    name: 'Constellation Spirits',
    kind: 'constellation',
    ready: false,
    tagline: 'Leo, Virgo and Pegasus, drawn in starlight.',
    contrast: 'treasures',
    swatches: { w: ['#fff6d8', '#ffd27a', '#5ef2ff'], b: ['#c9b6ff', '#9a7bff', '#ff3355'] },
    pieces: { k: 'Leo', q: 'Virgo', r: 'Taurus', b: 'Sagittarius', n: 'Pegasus', p: 'Aries' },
  },
];

const BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

export function isPresetId(v: unknown): v is PresetId {
  return typeof v === 'string' && BY_ID.has(v as PresetId);
}

export function presetMeta(id: PresetId): PresetMeta {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_PRESET)!;
}

export function readyPresets(): readonly PresetMeta[] {
  return PRESETS.filter((p) => p.ready);
}

/** The preset's contrast pair if that is ready to play, else the preset itself. */
export function contrastOf(id: PresetId): PresetId {
  const c = presetMeta(id).contrast;
  return presetMeta(c).ready ? c : id;
}

export function pieceLabel(
  preset: PresetId,
  type: PieceSymbol,
): { name: string; piece: string; glyph: string } {
  const t = TREASURES[type];
  return { name: presetMeta(preset).pieces[type], piece: t.piece, glyph: t.glyph };
}

export function presetPreview(id: PresetId, width: 320 | 640, base: string): string {
  return assetUrl(`presets/${id}-${width}.avif`, base);
}

export interface PresetChoice {
  mode: 'hotseat' | 'ai';
  whitePreset: PresetId;
  blackPreset: PresetId;
  linkPresets: boolean;
}

/**
 * The set each side plays. Linked: hot-seat plays the one choice on both sides; vs AI the player
 * plays it and the AI its contrast. Unlinked: each side's own choice, in both modes.
 */
export function resolvePresets(choice: PresetChoice, humanSide: Side): Record<Side, PresetId> {
  if (!choice.linkPresets) return { w: choice.whitePreset, b: choice.blackPreset };
  const mine = humanSide === 'w' ? choice.whitePreset : choice.blackPreset;
  if (choice.mode === 'hotseat') return { w: mine, b: mine };
  const theirs = contrastOf(mine);
  return humanSide === 'w' ? { w: mine, b: theirs } : { w: theirs, b: mine };
}
