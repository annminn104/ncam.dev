import { useEffect, useSyncExternalStore } from 'react';

export const STORAGE_KEY = 'holodex:collection:v1';

export type CollectionList = 'owned' | 'wishlist';

export interface CollectionState {
  version: 1;
  owned: string[];
  wishlist: string[];
}

export const EMPTY_COLLECTION: CollectionState = { version: 1, owned: [], wishlist: [] };

export interface CollectionStore {
  /** Stable identity between writes — required by useSyncExternalStore. */
  get: () => CollectionState;
  has: (list: CollectionList, cardId: string) => boolean;
  toggle: (list: CollectionList, cardId: string) => CollectionState;
  /** How many saved cards belong to a set, e.g. countWithPrefix('owned', 'swsh1-'). */
  countWithPrefix: (list: CollectionList, prefix: string) => number;
  subscribe: (listener: () => void) => () => void;
  /** Re-read storage, e.g. after another tab wrote. */
  refresh: () => void;
}

function parse(raw: string | null): CollectionState {
  if (!raw) return EMPTY_COLLECTION;
  try {
    const value = JSON.parse(raw) as Partial<CollectionState>;
    if (value?.version !== 1 || !Array.isArray(value.owned) || !Array.isArray(value.wishlist)) {
      return EMPTY_COLLECTION;
    }
    return {
      version: 1,
      owned: value.owned.filter((id): id is string => typeof id === 'string'),
      wishlist: value.wishlist.filter((id): id is string => typeof id === 'string'),
    };
  } catch {
    // Corrupt payload — start clean rather than break the page.
    return EMPTY_COLLECTION;
  }
}

/**
 * Owned / wishlist over an injected Storage.
 *
 * Storage can be missing (server), blocked (private mode) or full — every
 * access is guarded, and a failure degrades to an in-memory collection for the
 * session instead of throwing.
 */
export function createCollectionStore(storage: Storage | null): CollectionStore {
  const read = (): CollectionState => {
    try {
      return parse(storage?.getItem(STORAGE_KEY) ?? null);
    } catch {
      return EMPTY_COLLECTION;
    }
  };

  let state = read();
  const listeners = new Set<() => void>();

  const commit = (next: CollectionState): CollectionState => {
    state = next;
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Keep the in-memory value; the visitor loses persistence, not the feature.
    }
    for (const listener of listeners) listener();
    return next;
  };

  return {
    get: () => state,
    has: (list, cardId) => state[list].includes(cardId),
    toggle: (list, cardId) => {
      const current = state[list];
      const next = current.includes(cardId)
        ? current.filter((id) => id !== cardId)
        : [...current, cardId];
      return commit({ ...state, [list]: next });
    },
    countWithPrefix: (list, prefix) => state[list].filter((id) => id.startsWith(prefix)).length,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh: () => {
      state = read();
      for (const listener of listeners) listener();
    },
  };
}

export const collectionStore = createCollectionStore(
  typeof window === 'undefined' ? null : window.localStorage,
);

/**
 * Subscribes to the collection. The server snapshot is always empty, so any
 * component using this must not render collection-dependent markup during SSR
 * — see `mounted` in CollectionToggle.
 */
export function useCollectionState(): CollectionState {
  useEffect(() => {
    // Another tab wrote; pick it up.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) collectionStore.refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return useSyncExternalStore(
    collectionStore.subscribe,
    collectionStore.get,
    () => EMPTY_COLLECTION,
  );
}
