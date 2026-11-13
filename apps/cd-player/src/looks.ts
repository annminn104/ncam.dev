import { clearSwatch, DEFAULT_CLEAR_LOOK, type ClearLook } from './clear-looks';
import { deckSwatch, DEFAULT_DECK_LOOK, type DeckLook } from './deck-looks';
import { DEFAULT_LUXE_LOOK, luxeSwatch, type LuxeLook } from './luxe-looks';
import { DEFAULT_MODEL, type ModelId } from './models';
import { DEFAULT_PERSONAL, type Personal } from './personal';
import { DEFAULT_SKIN, skinById, type SkinId } from './skins';

/** What the scene draws: a model and its colours. Three-free on purpose. */
export type Look =
  | { model: 'suitcase'; skin: SkinId }
  | { model: 'clear'; clear: ClearLook }
  | { model: 'deck'; deck: DeckLook }
  | { model: 'luxe'; luxe: LuxeLook };

/** Everything the visitor chose, per model, so each model comes back in its own last colours. */
export interface LookState {
  model: ModelId;
  skin: SkinId;
  clear: ClearLook;
  deck: DeckLook;
  luxe: LuxeLook;
  /** The visitor's pattern and name (src/personal.ts). */
  personal: Personal;
}

export const DEFAULT_LOOK_STATE: LookState = {
  model: DEFAULT_MODEL,
  skin: DEFAULT_SKIN,
  clear: DEFAULT_CLEAR_LOOK,
  deck: DEFAULT_DECK_LOOK,
  luxe: DEFAULT_LUXE_LOOK,
  personal: DEFAULT_PERSONAL,
};

/**
 * The end of a switch over every model: a model a switch leaves out reaches here, which the
 * compiler refuses (`value` is `never` only once every model has its case), so no model ever falls
 * through to another's colours.
 */
export function exhaustive(value: never): never {
  throw new Error(`no case for ${JSON.stringify(value)}`);
}

/** The look the scene draws: the model's own colours only, never the visitor's pattern or name. */
export function lookOf(state: Pick<LookState, 'model' | 'skin' | 'clear' | 'deck' | 'luxe'>): Look {
  switch (state.model) {
    case 'suitcase':
      return { model: 'suitcase', skin: state.skin };
    case 'clear':
      return { model: 'clear', clear: state.clear };
    case 'deck':
      return { model: 'deck', deck: state.deck };
    case 'luxe':
      return { model: 'luxe', luxe: state.luxe };
    default:
      return exhaustive(state.model);
  }
}

export interface AccentPair {
  accent: string;
  onAccent: string;
}

/** The page's accent pair: the skin's, or the light's of the Clear model, the Deck or Luxe. */
export function lookAccent(look: Look): AccentPair {
  const pair = ({ accent, onAccent }: AccentPair): AccentPair => ({ accent, onAccent });
  switch (look.model) {
    case 'suitcase':
      return pair(skinById(look.skin));
    case 'clear':
      return pair(clearSwatch(look.clear, 'light'));
    case 'deck':
      return pair(deckSwatch(look.deck, 'light'));
    case 'luxe':
      return pair(luxeSwatch(look.luxe, 'light'));
    default:
      return exhaustive(look);
  }
}

/** The colour on the Player button: the skin's leather, or the light. */
export function lookSwatch(look: Look): string {
  switch (look.model) {
    case 'suitcase':
      return skinById(look.skin).palette.leather;
    case 'clear':
      return clearSwatch(look.clear, 'light').glow;
    case 'deck':
      return deckSwatch(look.deck, 'light').glow;
    case 'luxe':
      return luxeSwatch(look.luxe, 'light').glow;
    default:
      return exhaustive(look);
  }
}

/** The Player button's accessible name. */
export function lookLabel(look: Look): string {
  switch (look.model) {
    case 'suitcase':
      return `Player: Suitcase, ${skinById(look.skin).name}`;
    case 'clear':
      return `Player: Clear, ${clearSwatch(look.clear, 'light').name} light`;
    case 'deck':
      return `Player: Deck, ${deckSwatch(look.deck, 'light').name} light`;
    case 'luxe':
      return `Player: Luxe, ${luxeSwatch(look.luxe, 'light').name} light`;
    default:
      return exhaustive(look);
  }
}
