import { SPOTIFY_ID, type CollectionRef } from './routes';

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

/** `localStorage`, or null where there is none or it throws (private modes, sandboxed frames). */
export function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
