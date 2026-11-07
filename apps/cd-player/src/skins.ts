import data from './skins.json';

/**
 * The player's colourways. Every colour is in src/skins.json, which the shell (the picker, the
 * accent) and the scene (the recolour) read through this module. Three-free on purpose
 * (src/ssr-graph.test.ts).
 */
export type SkinId = 'blush' | 'sage' | 'cream' | 'cherry';

/** The parts a skin recolours; SKIN_ROLES (src/scene/material-roles.ts) names their materials. */
export type SkinRole = 'leather' | 'trim' | 'thread' | 'lining' | 'hardware' | 'deck' | 'grille';

export interface Skin {
  id: SkinId;
  /** What the picker calls it: 'Blush', 'Sage', 'Cream' or 'Cherry'. */
  name: string;
  /** The UI accent, sRGB hex. */
  accent: string;
  /** Text and icons on the accent, sRGB hex. */
  onAccent: string;
  /** sRGB hex per role. */
  palette: Readonly<Record<SkinRole, string>>;
}

export const DEFAULT_SKIN: SkinId = 'blush';

/** In the picker's order: Blush, Sage, Cream, Cherry. */
export const SKINS: readonly Skin[] = data.skins as Skin[];

const FALLBACK = SKINS.find((skin) => skin.id === DEFAULT_SKIN) as Skin;

/** The skin with that id; anything else (an old value, junk, nothing) is the default. */
export function skinById(id: string | null | undefined): Skin {
  return SKINS.find((skin) => skin.id === id) ?? FALLBACK;
}
