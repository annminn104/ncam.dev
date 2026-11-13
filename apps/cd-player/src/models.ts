/**
 * The players a visitor can pick under Player: the suitcase (the default, with its four skins),
 * the Clear model and the Deck (their colours chosen part by part). Luxe, a turntable, has its id,
 * its profile and its colours already, and joins the picker (`MODELS`) once its scene is wired.
 * Three-free on purpose (src/ssr-graph.test.ts); the scene's own numbers per model are in
 * src/scene/profiles.ts.
 */
export type ModelId = 'suitcase' | 'clear' | 'deck' | 'luxe';
export type LookKind = 'skins' | 'parts';

export interface ModelProfile {
  id: ModelId;
  /** What the picker calls it. */
  name: string;
  /** The GLB's path under public/. */
  glb: string;
  /** How its colours are chosen: the suitcase's skins, or the parts of the Clear model and the Deck. */
  looks: LookKind;
}

export const DEFAULT_MODEL: ModelId = 'suitcase';

/** In the picker's order. */
export const MODELS: readonly ModelProfile[] = [
  { id: 'suitcase', name: 'Suitcase', glb: 'assets/cd-player.glb', looks: 'skins' },
  { id: 'clear', name: 'Clear', glb: 'assets/cd-player-clear.glb', looks: 'parts' },
  { id: 'deck', name: 'Deck', glb: 'assets/cd-player-deck.glb', looks: 'parts' },
];

/** The model with that id; anything else is the default. */
export function modelById(id: string | null | undefined): ModelProfile {
  return MODELS.find((model) => model.id === id) ?? MODELS[0];
}
