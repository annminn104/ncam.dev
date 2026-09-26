import { describe, expect, it, vi } from 'vitest';
import { createCollectionStore, EMPTY_COLLECTION, STORAGE_KEY } from './collection';

function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  } as Storage;
}

describe('createCollectionStore', () => {
  it('starts empty when storage has nothing', () => {
    expect(createCollectionStore(fakeStorage()).get()).toEqual(EMPTY_COLLECTION);
  });

  it('reads an existing payload', () => {
    const storage = fakeStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, owned: ['swsh3-136'], wishlist: [] }),
    });
    expect(createCollectionStore(storage).has('owned', 'swsh3-136')).toBe(true);
  });

  it('toggles a card on and back off, persisting each time', () => {
    const storage = fakeStorage();
    const store = createCollectionStore(storage);
    store.toggle('owned', 'swsh3-136');
    expect(store.has('owned', 'swsh3-136')).toBe(true);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).owned).toEqual(['swsh3-136']);
    store.toggle('owned', 'swsh3-136');
    expect(store.has('owned', 'swsh3-136')).toBe(false);
  });

  it('keeps owned and wishlist independent', () => {
    const store = createCollectionStore(fakeStorage());
    store.toggle('wishlist', 'swsh3-1');
    expect(store.has('owned', 'swsh3-1')).toBe(false);
    expect(store.has('wishlist', 'swsh3-1')).toBe(true);
  });

  it('returns the same object identity until something changes', () => {
    // useSyncExternalStore re-renders forever if the snapshot is a new object
    // on every read.
    const store = createCollectionStore(fakeStorage());
    expect(store.get()).toBe(store.get());
    const before = store.get();
    store.toggle('owned', 'swsh3-1');
    expect(store.get()).not.toBe(before);
  });

  it('notifies subscribers on a write and stops after unsubscribe', () => {
    const store = createCollectionStore(fakeStorage());
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.toggle('owned', 'swsh3-1');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    store.toggle('owned', 'swsh3-2');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('counts cards belonging to one set by id prefix', () => {
    const store = createCollectionStore(fakeStorage());
    store.toggle('owned', 'swsh1-3');
    store.toggle('owned', 'swsh1-9');
    store.toggle('owned', 'swsh10-1');
    // swsh1 must not swallow swsh10 — the same prefix trap as the API's set filter.
    expect(store.countWithPrefix('owned', 'swsh1-')).toBe(2);
  });

  it('discards a corrupt payload instead of throwing', () => {
    const store = createCollectionStore(fakeStorage({ [STORAGE_KEY]: '{not json' }));
    expect(store.get()).toEqual(EMPTY_COLLECTION);
  });

  it('discards a payload from an unknown version', () => {
    const storage = fakeStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 99, owned: ['x'], wishlist: [] }),
    });
    expect(createCollectionStore(storage).get()).toEqual(EMPTY_COLLECTION);
  });

  it('degrades to memory when storage throws on write', () => {
    const storage = fakeStorage();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const store = createCollectionStore(storage);
    expect(() => store.toggle('owned', 'swsh3-1')).not.toThrow();
    expect(store.has('owned', 'swsh3-1')).toBe(true);
  });

  it('works with no storage at all (server render)', () => {
    const store = createCollectionStore(null);
    expect(store.get()).toEqual(EMPTY_COLLECTION);
    expect(() => store.toggle('owned', 'swsh3-1')).not.toThrow();
  });
});
