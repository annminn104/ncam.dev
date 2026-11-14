/**
 * The players a visitor can pick under Player: the suitcase, with its four skins, and the Clear
 * model, the Deck and Luxe, a turntable, whose colours are chosen part by part. Luxe is the
 * default (`DEFAULT_MODEL`). Three-free on purpose (src/ssr-graph.test.ts); the scene's own
 * numbers per model are in src/scene/profiles.ts.
 */
export type ModelId = 'suitcase' | 'clear' | 'deck' | 'luxe';
export type LookKind = 'skins' | 'parts';

export interface ModelProfile {
  id: ModelId;
  /** What the picker calls it. */
  name: string;
  /** The GLB's path under public/. */
  glb: string;
  /** How its colours are chosen: the suitcase's skins, or the parts of the Clear model, the Deck and Luxe. */
  looks: LookKind;
}

/** The model a visitor who never chose one sees: Luxe (the owner's choice, 2026-11-14). */
export const DEFAULT_MODEL: ModelId = 'luxe';

/** In the picker's order, the default, Luxe, last. */
export const MODELS: readonly ModelProfile[] = [
  { id: 'suitcase', name: 'Suitcase', glb: 'assets/cd-player.glb', looks: 'skins' },
  { id: 'clear', name: 'Clear', glb: 'assets/cd-player-clear.glb', looks: 'parts' },
  { id: 'deck', name: 'Deck', glb: 'assets/cd-player-deck.glb', looks: 'parts' },
  { id: 'luxe', name: 'Luxe', glb: 'assets/cd-player-luxe.glb', looks: 'parts' },
];

const FALLBACK = MODELS.find((model) => model.id === DEFAULT_MODEL) as ModelProfile;

/** The model with that id; anything else (an old value, junk, nothing) is the default. */
export function modelById(id: string | null | undefined): ModelProfile {
  return MODELS.find((model) => model.id === id) ?? FALLBACK;
}
