import { describe, expect, it } from 'vitest';
import { readLast, restoreTarget, STORAGE_KEY, writeLast } from './persist';
import { DEFAULT_COLLECTION, type CollectionRef } from './routes';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}
const ID = '37i9dQZEVXbMDoHDwVN2tF';

describe('persist', () => {
  it('round-trips the last collection', () => {
    const storage = memory();
    writeLast(storage, { type: 'album', id: ID });
    expect(storage.data.get(STORAGE_KEY)).toBe(JSON.stringify({ type: 'album', id: ID }));
    expect(readLast(storage)).toEqual({ type: 'album', id: ID });
  });

  it('ignores junk, wrong types, missing storage and throwing storage', () => {
    expect(readLast(memory({ [STORAGE_KEY]: '{nope' }))).toBeNull();
    expect(
      readLast(memory({ [STORAGE_KEY]: JSON.stringify({ type: 'track', id: ID }) })),
    ).toBeNull();
    expect(
      readLast(memory({ [STORAGE_KEY]: JSON.stringify({ type: 'album', id: 'short' }) })),
    ).toBeNull();
    expect(readLast(null)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readLast(broken)).toBeNull();
    expect(() => writeLast(broken, { type: 'album', id: ID })).not.toThrow();
  });
});

describe('restoreTarget', () => {
  const saved: CollectionRef = { type: 'album', id: '64LU4c1nfjz1t4VnGhagcg' };

  it('sends `/` to the saved collection the first time this page load looks', () => {
    expect(restoreTarget('home', saved, false)).toEqual(saved);
  });

  it('stays put once this page load has looked, so Back to `/` is not bounced forward', () => {
    expect(restoreTarget('home', saved, true)).toBeNull();
  });

  it('leaves a collection URL alone', () => {
    expect(restoreTarget('collection', saved, false)).toBeNull();
  });

  it('has nowhere to go when the saved collection is the default one', () => {
    expect(restoreTarget('home', { ...DEFAULT_COLLECTION }, false)).toBeNull();
  });

  it('has nowhere to go when nothing is saved', () => {
    expect(restoreTarget('home', null, false)).toBeNull();
  });
});
