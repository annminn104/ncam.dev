import { clearSwatch, DEFAULT_CLEAR_LOOK, type ClearLook } from './clear-looks';
import { DEFAULT_MODEL, type ModelId } from './models';
import { DEFAULT_SKIN, skinById, type SkinId } from './skins';

/** What the scene draws: a model and its colours. Three-free on purpose. */
export type Look = { model: 'suitcase'; skin: SkinId } | { model: 'clear'; clear: ClearLook };

/** Everything the visitor chose, per model, so each model comes back in its own last colours. */
export interface LookState {
  model: ModelId;
  skin: SkinId;
  clear: ClearLook;
}

export const DEFAULT_LOOK_STATE: LookState = {
  model: DEFAULT_MODEL,
  skin: DEFAULT_SKIN,
  clear: DEFAULT_CLEAR_LOOK,
};

export function lookOf(state: LookState): Look {
  return state.model === 'clear'
    ? { model: 'clear', clear: state.clear }
    : { model: 'suitcase', skin: state.skin };
}

export interface AccentPair {
  accent: string;
  onAccent: string;
}

/** The page's accent pair: the skin's, or the Clear model's light's. */
export function lookAccent(look: Look): AccentPair {
  if (look.model === 'clear') {
    const { accent, onAccent } = clearSwatch(look.clear, 'light');
    return { accent, onAccent };
  }
  const { accent, onAccent } = skinById(look.skin);
  return { accent, onAccent };
}

/** The colour on the Player button: the skin's leather, or the light. */
export function lookSwatch(look: Look): string {
  return look.model === 'clear'
    ? clearSwatch(look.clear, 'light').glow
    : skinById(look.skin).palette.leather;
}

/** The Player button's accessible name. */
export function lookLabel(look: Look): string {
  return look.model === 'clear'
    ? `Player: Clear, ${clearSwatch(look.clear, 'light').name} light`
    : `Player: Suitcase, ${skinById(look.skin).name}`;
}
