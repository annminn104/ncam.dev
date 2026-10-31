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

/**
 * The saved skin's accent pair on `.cdp-root` before the first paint: the text of the inline
 * script App renders as the root's first child, which the browser runs as it parses the server's
 * markup. The server and the first client render are in Blush, so the trees match, and the page's
 * pastel is made from the accent: without it a saved Sage would paint Blush's whole page until the
 * remote hydrates. React leaves the attribute as it is when it hydrates (it never patches a
 * server attribute) and then applies the same saved skin. A copy React renders on the client never
 * runs, so `mount()` starts App in the saved skin instead. What `readSkin` refuses changes nothing.
 */
export const SKIN_SCRIPT = `(function(){try{var m=${JSON.stringify(
  Object.fromEntries(SKINS.map((skin) => [skin.id, [skin.accent, skin.onAccent]])),
)},k=localStorage.getItem(${JSON.stringify(SKIN_KEY)}),a=k&&Object.prototype.hasOwnProperty.call(m,k)?m[k]:0,s=document.currentScript.parentNode.style;if(a){s.setProperty('--cdp-accent',a[0]);s.setProperty('--cdp-on-accent',a[1]);}}catch(e){}})();`;

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
