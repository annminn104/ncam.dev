import { clearSwatch, DEFAULT_CLEAR_LOOK, type ClearLook } from './clear-looks';
import { deckSwatch, DEFAULT_DECK_LOOK, type DeckLook } from './deck-looks';
import { DEFAULT_MODEL, type ModelId } from './models';
import { DEFAULT_PERSONAL, type Personal } from './personal';
import { DEFAULT_SKIN, skinById, type SkinId } from './skins';

/** What the scene draws: a model and its colours. Three-free on purpose. */
export type Look =
  | { model: 'suitcase'; skin: SkinId }
  | { model: 'clear'; clear: ClearLook }
  | { model: 'deck'; deck: DeckLook };

/** Everything the visitor chose, per model, so each model comes back in its own last colours. */
export interface LookState {
  model: ModelId;
  skin: SkinId;
  clear: ClearLook;
  deck: DeckLook;
  /** The visitor's pattern and name (src/personal.ts). */
  personal: Personal;
}

export const DEFAULT_LOOK_STATE: LookState = {
  model: DEFAULT_MODEL,
  skin: DEFAULT_SKIN,
  clear: DEFAULT_CLEAR_LOOK,
  deck: DEFAULT_DECK_LOOK,
  personal: DEFAULT_PERSONAL,
};

export function lookOf(state: LookState): Look {
  if (state.model === 'clear') return { model: 'clear', clear: state.clear };
  if (state.model === 'deck') return { model: 'deck', deck: state.deck };
  return { model: 'suitcase', skin: state.skin };
}

export interface AccentPair {
  accent: string;
  onAccent: string;
}

/** The page's accent pair: the skin's, or the Clear model's or the Deck's light's. */
export function lookAccent(look: Look): AccentPair {
  if (look.model === 'clear') {
    const { accent, onAccent } = clearSwatch(look.clear, 'light');
    return { accent, onAccent };
  }
  if (look.model === 'deck') {
    const { accent, onAccent } = deckSwatch(look.deck, 'light');
    return { accent, onAccent };
  }
  const { accent, onAccent } = skinById(look.skin);
  return { accent, onAccent };
}

/** The colour on the Player button: the skin's leather, or the light. */
export function lookSwatch(look: Look): string {
  if (look.model === 'clear') return clearSwatch(look.clear, 'light').glow;
  if (look.model === 'deck') return deckSwatch(look.deck, 'light').glow;
  return skinById(look.skin).palette.leather;
}

/** The Player button's accessible name. */
export function lookLabel(look: Look): string {
  if (look.model === 'clear')
    return `Player: Clear, ${clearSwatch(look.clear, 'light').name} light`;
  if (look.model === 'deck') return `Player: Deck, ${deckSwatch(look.deck, 'light').name} light`;
  return `Player: Suitcase, ${skinById(look.skin).name}`;
}
