import { CLEAR_SWATCHES, clearLookFrom, DEFAULT_CLEAR_LOOK, type ClearLook } from './clear-looks';
import { deckLookFrom, DEFAULT_DECK_LOOK, type DeckLook } from './deck-looks';
import type { LookState } from './looks';
import { DEFAULT_MODEL, modelById, type ModelId } from './models';
import { DEFAULT_COLLECTION, SPOTIFY_ID, sameCollection, type CollectionRef } from './routes';
import { DEFAULT_SKIN, SKINS, skinById, type SkinId } from './skins';

/** The visitor's last playlist or album, so `/projects/cd-player` comes back as theirs. */
export const STORAGE_KEY = 'ncam.cd-player.last';

type ReadStore = Pick<Storage, 'getItem'>;
type WriteStore = Pick<Storage, 'setItem'>;

export function readLast(storage: ReadStore | null): CollectionRef | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CollectionRef>;
    if (
      (value.type === 'playlist' || value.type === 'album') &&
      typeof value.id === 'string' &&
      SPOTIFY_ID.test(value.id)
    ) {
      return { type: value.type, id: value.id };
    }
  } catch {
    // Unreadable or blocked storage is no saved link.
  }
  return null;
}

export function writeLast(storage: WriteStore | null, ref: CollectionRef): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ type: ref.type, id: ref.id }));
  } catch {
    // A full or blocked storage just forgets.
  }
}

/** The visitor's colourway for the player (src/skins.ts), kept apart from the collection. */
export const SKIN_KEY = 'ncam.cd-player.skin';

/** The saved skin; nothing saved, an id no skin has, or storage that throws is the default. */
export function readSkin(storage: ReadStore | null): SkinId {
  try {
    return skinById(storage?.getItem(SKIN_KEY)).id;
  } catch {
    // Unreadable or blocked storage is no saved skin.
    return DEFAULT_SKIN;
  }
}

export function writeSkin(storage: WriteStore | null, id: SkinId): void {
  try {
    storage?.setItem(SKIN_KEY, id);
  } catch {
    // A full or blocked storage just forgets.
  }
}

/** The visitor's model (src/models.ts): the suitcase unless they chose the Clear one. */
export const MODEL_KEY = 'ncam.cd-player.model';
/** The Clear model's colours, part by part (src/clear-looks.ts), as JSON. */
export const CLEAR_KEY = 'ncam.cd-player.clear';
/** The Deck's colours, part by part (src/deck-looks.ts), as JSON. */
export const DECK_KEY = 'ncam.cd-player.deck';

/** The saved model; nothing saved, an id no model has, or storage that throws is the suitcase. */
export function readModel(storage: ReadStore | null): ModelId {
  try {
    return modelById(storage?.getItem(MODEL_KEY)).id;
  } catch {
    // Unreadable or blocked storage is no saved model.
    return DEFAULT_MODEL;
  }
}

export function writeModel(storage: WriteStore | null, id: ModelId): void {
  try {
    storage?.setItem(MODEL_KEY, id);
  } catch {
    // A full or blocked storage just forgets.
  }
}

/** The saved Clear colours, part by part; a part that is missing or unknown is its default. */
export function readClearLook(storage: ReadStore | null): ClearLook {
  try {
    const raw = storage?.getItem(CLEAR_KEY);
    return clearLookFrom(raw ? (JSON.parse(raw) as unknown) : null);
  } catch {
    // Unreadable storage or JSON that does not parse is no saved look.
    return DEFAULT_CLEAR_LOOK;
  }
}

export function writeClearLook(storage: WriteStore | null, look: ClearLook): void {
  try {
    storage?.setItem(CLEAR_KEY, JSON.stringify(look));
  } catch {
    // A full or blocked storage just forgets.
  }
}

/** The saved Deck colours, part by part; a part that is missing or unknown is its default. */
export function readDeckLook(storage: ReadStore | null): DeckLook {
  try {
    const raw = storage?.getItem(DECK_KEY);
    return deckLookFrom(raw ? (JSON.parse(raw) as unknown) : null);
  } catch {
    // Unreadable storage or JSON that does not parse is no saved look.
    return DEFAULT_DECK_LOOK;
  }
}

export function writeDeckLook(storage: WriteStore | null, look: DeckLook): void {
  try {
    storage?.setItem(DECK_KEY, JSON.stringify(look));
  } catch {
    // A full or blocked storage just forgets.
  }
}

/** Everything saved: the model, the suitcase's skin, and the Clear model's and the Deck's colours. */
export function readLookState(storage: ReadStore | null): LookState {
  return {
    model: readModel(storage),
    skin: readSkin(storage),
    clear: readClearLook(storage),
    deck: readDeckLook(storage),
  };
}

const SKIN_PAIRS = Object.fromEntries(SKINS.map((skin) => [skin.id, [skin.accent, skin.onAccent]]));
const LIGHT_PAIRS = Object.fromEntries(
  CLEAR_SWATCHES.light.map((light) => [light.id, [light.accent, light.onAccent]]),
);

// What JSON.stringify leaves as it is but an inline script must not hold: `<`, `>` and `/` (a string
// holding `</script>` or `<!--` would end the element or change how it parses) and U+2028 and
// U+2029 (line terminators to scripts older than ES2019). Each becomes its \u escape, which the
// script reads back as the same character, and JSON puts them only inside strings.
const SCRIPT_UNSAFE: Record<string, string> = {
  '<': '\\u003C',
  '>': '\\u003E',
  '/': '\\u002F',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

/** `value` as a literal for an inline script: its JSON, with the characters above escaped. */
export function scriptLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/[<>/\u2028\u2029]/g, (char) => SCRIPT_UNSAFE[char]);
}

/**
 * The accent pair of the saved look on `.cdp-root` before the first paint: the text of the inline
 * script App renders as the root's first child, which the browser runs as it parses the server's
 * markup. It paints the saved light's pair when the saved model is the Clear one (its default
 * light's where the saved colours name none) and the saved skin's pair otherwise. The server and
 * the first client render are in the suitcase's Blush, so the trees match, and the page's pastel
 * is made from the accent: without it a saved Sage or a saved pink light would paint Blush's whole
 * page until the remote hydrates. React leaves the attribute as it is when it hydrates (it never
 * patches a server attribute) and then applies the same saved look. A copy React renders on the
 * client never runs, so `mount()` starts App in the saved look instead. It reads only own keys of
 * its tables, so no saved value can pick a prototype's, and it never throws: what `readLookState`
 * refuses, or storage that throws, changes nothing. Its tables and keys go in through
 * `scriptLiteral`, so none of them can end the element it is written into.
 */
export const LOOK_SCRIPT = `(function(){try{var s=${scriptLiteral(SKIN_PAIRS)},l=${scriptLiteral(
  LIGHT_PAIRS,
)},t=localStorage,h=Object.prototype.hasOwnProperty,a=0,k;if(t.getItem(${scriptLiteral(
  MODEL_KEY,
)})==='clear'){try{k=JSON.parse(t.getItem(${scriptLiteral(CLEAR_KEY)})).light}catch(e){}a=typeof k==='string'&&h.call(l,k)?l[k]:l[${scriptLiteral(
  DEFAULT_CLEAR_LOOK.light,
)}]}else{k=t.getItem(${scriptLiteral(SKIN_KEY)});a=k&&h.call(s,k)?s[k]:0}if(a){var r=document.currentScript.parentNode.style;r.setProperty('--cdp-accent',a[0]);r.setProperty('--cdp-on-accent',a[1])}}catch(e){}})();`;

/**
 * Where `/` should send the visitor: the collection they last loaded. Only the first time the caller
 * looks (`alreadyRestored` false; App keeps that per mount), because Back to `/` must not bounce them
 * forward again; only on `/` itself; and never to the default playlist, which `/` already shows.
 */
export function restoreTarget(
  routeView: 'home' | 'collection',
  last: CollectionRef | null,
  alreadyRestored: boolean,
): CollectionRef | null {
  if (routeView !== 'home' || alreadyRestored || !last) return null;
  return sameCollection(last, DEFAULT_COLLECTION) ? null : last;
}

/** `localStorage`, or null where there is none or it throws (private modes, sandboxed frames). */
export function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
