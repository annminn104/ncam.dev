import { describe, expect, it } from 'vitest';
import { readLast, STORAGE_KEY, writeLast } from './persist';

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
